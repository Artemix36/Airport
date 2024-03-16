// TODO: бэкап в SQLite ?

const axios = require('axios');
const carRoutes = require('./carRoute');
const MD5 = require('crypto-js/md5');
const { response } = require('express');

const dispatcherURL = 'http://localhost:9008';  // Ресурс Диспетчера
const HSURL = 'http://localhost:9004';          // Ресурс УНО
const planeURL = 'http://localhost:9008';       // Ресурс Борта
// const visualizerURL = 'http://localhost:9010';  // Ресурс визуализатора

const POST_Headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

// Список машинок
let luggageCars = [];

// Список багажей в багажном терминале
// TODO: Согласовать с Архипом свойства багажа
let luggageTerminal = [];

// Задержка в мс
let eventTimeout = 1000;

// Нахождение индекса машинки, у которой поданный UID
async function findIndexWithKey(key) {
    return luggageCars.map(car => { return car.id; }).indexOf(key);
}

// Добавление новой машинки в систему
function spawnNewCar() {
    if (luggageCars.length < 4) {
        const newCar = {
            id: MD5(Math.random().toString()).toString(),
            position: {
                row: carRoutes.spawnRow,
                col: carRoutes.spawnCol
            },
            home: {
                row: carRoutes.spawnRow,
                col: carRoutes.spawnCol
            },
            direction: "up",
            status: "ready",
            job: {
                plane_id: null,
                plane_row: null,
                plane_col: null,
            },
            luggage: []
        };
        luggageCars.push(newCar);
        carRoutes.spawnCol++;
        console.log(`${new Date()} В Baggage Tractor добавлена новая машинка с id ${newCar.id}`);
    } else {
        console.error(`${new Date()} Baggage Tractor не может добавить новую машинку в систему, т.к. лимит - 4!`);
    }
}

// TODO: это вряд ли нужно
// Если рядом с поданной машинкой есть другая моя машинка
// function thereAreMyCarsNearTheCar(car) {
//     return luggageCars.some(other_car => {
//        return (Math.abs(car.position.row - other_car.position.row === 1) || Math.abs(car.position.col - other_car.position.col === 1));
//     });
// }

// Подфункция для перемещения машинки на заданную координату
async function moveCar(car, targetRow, targetCol) {
    console.log(`Baggage Tractor сообщает в диспетчерскую о перемещении машинки ${car.id} на ${targetRow}, ${targetCol}.`);
    setTimeout(async () => {
        await axios.post(`${dispatcherURL}/v1/map/move/${car.position.row}/${car.position.col}/${targetRow}/${targetCol}`, {}, {POST_Headers})
            .then((response) => {
                // Здесь меняю направление машинки
                if (targetRow !== car.position.row)
                    (car.position.row < targetRow) ? car.direction = 'down' : car.direction = 'up';
                else if (targetCol !== car.position.col)
                    (car.position.col < targetCol) ? car.direction = 'right' : car.direction = 'left';

                car.position.row = targetRow;
                car.position.col = targetCol;
                console.log(`${new Date()} Baggage Tractor переместил машинку ${car.id} на клетку ${targetRow}, ${targetCol}.`);
            })
            .catch(err => {
                console.log(`${new Date()} В процессе перемещения машинки ${car.id} на на клетку ${targetRow}, ${targetCol} возникла ошибка!`);
            });
    }, eventTimeout);
}

// Подфункция для попытки безопасного перемещения на заданную координату
async function tryToMoveCar(car, targetRow, targetCol) {
    console.log(`${new Date()} Baggage Tractor спрашивает у диспетчера разрешение на перемещение машинки ${car.id} на ${targetRow}, ${targetCol}.`);
    await axios.get(`${dispatcherURL}/v1/map/at/${targetRow}/${targetCol}`, { headers: { 'Accept': 'application/json' } })
        .then(async (response) => {
            console.log(`${new Date()} Debug (dispatcher GET-request): `, response.data);
            // Если клетка не занята
            if (response.data.state === "0") {
                await moveCar(car, targetRow, targetCol);
            } else {
                console.log(`${new Date()} Baggage Tractor попытался переместиться машинку ${car.id} на клетку ${targetRow}, ${targetCol}, но диспетчер не разрешил. Микросервис попробует ещё раз после 1 секунды.`);
                // Новый запрос выполняется рекурсивно
                setTimeout(async () => {
                    await tryToMoveCar(car, targetRow, targetCol);
                }, 1000);
            }
        })
        .catch(err => {
           console.log(`${new Date()} В процессе перемещения машинки ${car.id} на на клетку ${targetRow}, ${targetCol} возникла ошибка!`);
        });
}

// Прогнать машинку по маршруту
async function moveCarThroughRoute(car, route) {

    await route.forEach(async (coordinate) => {
        // Если клетка "не критическая", т.е. не пересекается с чужими дорогами
        if (coordinate[2]) {
            // Тем не менее, здесь стоит сделать проверку на проезжающую рядом мою машинку
            // if (!(thereAreMyCarsNearTheCar(car))) {
            await moveCar(car, coordinate[0], coordinate[1]);
            // else console.log(`${getTimestamp()} Baggage Tractor не переместил машинку ${car.id} на клетку ${coordinate[0]}, ${coordinate[1]}, т.к. рядом проезжают другие машинки этого же сервиса.`);
        } else {
            await tryToMoveCar(car, coordinate[0], coordinate[1]);
        }
    });
}

// Прогнать машинку до точки (без маршрута), с проверкой на каждом ходу
async function moveCarToPointUnrouted(car, targetRow, targetCol) {
    let rowStep; let colStep;
    car.position.row < targetRow ? rowStep = 1 : rowStep = -1;
    car.position.col < targetCol ? colStep = 1 : colStep = -1;

    // Сначала машинка едет до нужной строки, потом до нужного столбца
    while (car.position.row !== targetRow) {
        // await tryToMoveCar(car, car.position.row + rowStep, car.position.col);
        await moveCar(car, car.position.row + rowStep, car.position.col);
    }
    while (car.position.col !== targetCol) {
        // await tryToMoveCar(car, car.position.row, car.position.col + colStep);
        await moveCar(car, car.position.row, car.position.col + colStep);
    }
}

// Загрузка багажа в машинку из терминала
async function unloadTerminal(car, flightID) {
    // Машинка берёт из терминала багаж, связанный с данным конкретным рейсом
    car.luggage = luggageTerminal.filter(luggage_item => {
        luggage_item.flight_id = flightID;
    });
    // И терминал очищается от этих сумочек
    luggageTerminal = luggageCars.filter(luggage_item => {
        !(luggage_item.flight_id = flightID);
    });
    console.log(`${new Date()} Машинка ${car.id} из Baggage Tractor забрала из терминала весь багаж, связанный с рейсом ${flightID}`);
}

// Выгрузка багажа из машинки в терминал
async function loadTerminal(car, flightID) {
    // Машинка кладёт весь свой багаж в терминал)
    // await car.luggage.forEach(luggage_item => {
    //     luggageTerminal.push(luggage_item);
    // });
    // И очищается духовно
    car.luggage = [];
    console.log(`${new Date()} Машинка ${car.id} из Baggage Tractor выгрузила в терминал весь багаж, связанный с рейсом ${flightID}`);
}

// Принятие багажа из регистрации (очередь)
// function acceptLuggageFromRegistration(req, res) {
//     // Нихасю очередь... :(
//     const luggageObj = req.body;
//     if (luggageObj.id && luggageObj.passenger_id && luggageObj.flight_id) {
//         luggageTerminal.push(luggageObj);
//         res.status(200).send('');
//         console.log(`${new Date()} Baggage Tractor принял багаж от сервиса регистрации: ${req.body}`);
//     } else {
//         console.log(`${new Date()} Baggage Tractor получил от регистрации неправильный багаж, поэтому проигнорирова его`);
//         res.status(400).send('Wrong format!');
//     }
// }

// Выгрузка багажа из машинки в самолёт
async function loadPlane(car, planeID) {
    await axios.post(`${planeURL}/v1/airplanes/${planeID}/luggage/load`, car.luggage, { POST_Headers })
        .then(response => {
            console.log(`Машинка ${car.id} загрузила багаж на самолёт ${planeID}, ответ: `, response);
            car.luggage = [];
        })
        .catch(err => {
           console.log(`${new Date()} В процессе загрузки самолёта багажом машинкой ${planeID} возникла ошибка: `, err);
        });
}

// Выгрузка багажа из самолёта в машинку
async function unloadPlane(car, planeID) {
    await axios.post(`${planeURL}/v1/airplanes/${planeID}/luggage/unload`, {}, { POST_Headers } )
        .then(response => {
            car.luggage = response.data;
            console.log(`Машинка ${car.id} разгрузила самолёт ${planeID}, ответ: `, response);
        })
        .catch(err => {
            console.log(`${new Date()} В процессе разгрузки самолёта машинкой ${planeID} возникла ошибка: `, err);
        });
}

// Удаление машинки из системы (зачем ?)
async function deleteCar() {
    await luggageCars.pop();
    carRoutes.spawnCol--;
    console.log(`${new Date()} Baggage Tractor какого-то хуя удалил машинку`);
}

// Ответка на запрос о машинках
async function handleVisuals(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');  // Надо...
    res.setHeader('content-type', 'application/json');

    let result = [];

    luggageCars.forEach(car => {
        result.push({
            "type": "cart",
            "position": {
                "row": car.position.row,
                "column": car.position.col
            },
            "direction": car.direction
        });
    });

    res.status(200).send(result);
    // console.log(`${new Date()} Baggage Tractor отправил данные о машинках визуализатору`);
}


// Обработка запроса УНО
async function handleHSRequest(req, res) {
    const planeID = req.params.id;
    console.log(`${new Date()} Baggage Tractor получил запрос от Handling Supervisor обслужить самолёт ${planeID}`);

    let planeRow;
    let planeCol;
    let takeOffFlightID;

    // Здесь запрашиваю данные по самолёту
    console.log(`${new Date()} Baggage Tractor запрашивает данные по рейсу ${planeID} у микросервиса Board`);
    await axios.get(`${planeURL}/v1/airplane/${planeID}`, { headers: { 'Accept': 'application/json' } })
        .then(response => {
            const planeData = response.data.airplane;
            const parkingSpot = parseInt(planeData.parking_spot);

            // Получение координат парковки самолёта
            planeRow = carRoutes.parkingSpots[parkingSpot[0]];
            planeCol = carRoutes.parkingSpots[parkingSpot[1]];
            takeOffFlightID = planeData.voyage_b_id;

            console.log(`${getTimestamp()} Baggage Tractor получил от микросервиса Board данные о самолёте ${planeID}`);
        })
        .catch((err) => {
            console.error(`${getTimestamp()} В процессе запроса данных о самолёте ${flightID} возникла ошибка!`, err);
        });

    // Нахождение индекса ближайшей к выездной точке машинки
    let nearestCarIndex;
    let maxCol = -1;
    for (let i = 0; i < luggageCars.length; i++) {
        if ((luggageCars[i].position.col > maxCol) && (luggageCars[i].status === 'ready')) {
            maxCol = luggageCars[i].position.col;
            nearestCarID = luggageCars[i].id;
            nearestCarIndex = i;
        }
    }

    // Если свободных машинок нет
    if (maxCol === -1) {
        console.log(`${getTimestamp()} Baggage Tractor не имеет свободных машинок и сообщает об этом Handling Supervisor`);
        res.status(400).send('No free cars!');
    } else {
        const currentCar = luggageCars[nearestCarIndex];
        currentCar.status = 'busy';
        currentCar.job.plane_id = planeID;
        currentCar.job.plane_row = planeRow;
        currentCar.job.plane_col = planeCol;

        // Отправляю ответ УНО
        res.status(200).send(currentCar.id);
        console.log(`${getTimestamp()} Baggage Tractor принял запрос от УНО обслужить самолёт ${planeID} и отправил машинку ${currentCar.id} работать`);

        // Здесь уже начинаю движение
        // Тачка едет до точки отъезда и по первым двум дорожкам
        await moveCarToPointUnrouted(currentCar, carRoutes.dispatchRow, carRoutes.dispatchCol);
        await moveCarThroughRoute(currentCar, carRoutes.road_1);
        await moveCarThroughRoute(currentCar, carRoutes.road_2);
        await moveCarThroughRoute(currentCar, carRoutes.road_3);

        // Дальше крадется до середины площадки
        await moveCarToPointUnrouted(currentCar, carRoutes.planeZoneRow, carRoutes.planeZoneCol);

        // Сообщаю об этом УНО
        console.log(`${new Data()} Машинка ${currentCar.id} доехала до центра площадки и послала запрос УНО об этом`)
        await axios.post(`${HSURL}/v1/car/here/${currentCar.id}`, {}, { POST_Headers })
            .then((response) => {
                console.log(`${new Data()} УНО успешно принял сигнал о подъезде машинки ${currentCar.id} к площадке`);
            })
            .catch((err) => {
                console.error(`${new Data()} Во время сообщения УНО о подъезде машинки ${currentCar.id} возникла ошибка!`);
            });

    }
}

async function goHome(car) {
    // Дальше снова до центра площадки
    await moveCarToPointUnrouted(car, carRoutes.planeZoneRow, carRoutes.planeZoneCol);
    // Дальше крадётся до точки выезда
    await moveCarToPointUnrouted(car, carRoutes.returnRow, carRoutes.returnCol);

    // Едет домой
    await moveCarThroughRoute(car, carRoutes.road_4);
    await moveCarThroughRoute(car, carRoutes.road_5);
    await moveCarThroughRoute(car, carRoutes.road_6);

    // И садится жопой на своё место.
    await moveCarToPointUnrouted(car, car.home.row, car.home.col);
    car.status = 'ready';
    car.job.plane_id = null;
    car.job.plane_row = null;
    car.job.plane_col = null;
}

// Выполнение функционала с самолётом
async function doAction(req, res) {
    const carID = req.params.id;
    console.log(`${new Date()} Baggage Tractor получил запрос do-action для машинки ${carID}`);

    const currentCar = luggageCars[await findIndexWithKey(carID)];

    const planeID = currentCar.job.plane_id;
    const planeRow = currentCar.job.plane_row;
    const planeCol = currentCar.job.plane_col;

    // Потом к самому самолёту
    await moveCarToPointUnrouted(currentCar, planeRow, planeCol);
    // Разгружает самолёт
    await unloadPlane(currentCar, planeID);

    // Дальше снова до центра площадки
    await moveCarToPointUnrouted(currentCar, carRoutes.planeZoneRow, carRoutes.planeZoneCol);
    // Дальше крадётся до точки выезда
    await moveCarToPointUnrouted(currentCar, carRoutes.returnRow, carRoutes.returnCol);

    await moveCarThroughRoute(currentCar, carRoutes.road_4);
    await moveCarThroughRoute(currentCar, carRoutes.road_5);
    await moveCarThroughRoute(currentCar, carRoutes.road_7);
    await moveCarThroughRoute(currentCar, carRoutes.road_2);

    // Выгрузка багажа
    await loadTerminal(currentCar);
    // Загрузка багажа на следующий рейс
    await unloadTerminal(currentCar, takeOffFlightID);

    await moveCarThroughRoute(currentCar, carRoutes.road_3);

    // Дальше опять крадется до середины площадки
    await moveCarToPointUnrouted(currentCar, carRoutes.planeZoneRow, carRoutes.planeZoneCol);
    // Потом к самому самолёту
    await moveCarToPointUnrouted(currentCar, planeRow, planeCol);

    // Загружаю его
    await loadPlane(currentCar, planeID);

    console.log(`${new Date()} Baggage Tractor сообщил Handling Supervisor об окончании работы ${carID}`);
    await axios.post(`${HSURL}/v1/car/done/${carID}`, {}, {POST_Headers})
        .then((response) => {
            console.log(`${new Date()} Handling Supervisor успешно получил сигнал об окончании работы машинки ${carID}`);
        })
        .catch((error) => {
            console.error(`${new Date} В процессе сообщения микросервису Handling Supervisor об окончании работы машинки ${carID} возникла ошибка: `, error);
        });

    // Возвращаюсь домой машинкой
    await goHome(currentCar);
}

// function changeSpeed(req, res) {
//     let reqTimeout;
//     try {
//         reqTimeout = req.params.timeout;
//         eventTimeout = reqTimeout;
//         console.log(`${new Date()} Baggage Tractor сменил скорость симуляции`);
//     } catch(err) {
//         console.log(`${new Date()} В процессе смены скорости симуляции возникла ошибка!`);
//     }
// }

module.exports = {
    luggageTerminal,
    spawnNewCar,
    handleVisuals,
    handleHSRequest,
    doAction,
}
