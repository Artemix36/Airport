// TODO: бэкап в SQLite ?

const axios = require('axios');
const carRoutes = require('./carRoute');
const MD5 = require('crypto-js/md5');

const dispatcherURL = 'http://localhost:9008';  // Ресурс Диспетчера
// const HSURL = 'http://localhost:9004';          // Ресурс УНО
const planeURL = 'http://localhost:9008';       // Ресурс Борта
// const visualizerURL = 'http://localhost:9010';  // Ресурс визуализатора

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
    console.log(`Baggage Tractor делает сообщает в диспетчерскую о перемещении машинки ${car.id} на ${targetRow}, ${targetCol}.`);
    setTimeout(async () => {
        await axios.post(`${dispatcherURL}/v1/map/move/${car.position.row}/${car.position.col}/${targetRow}/${targetCol}`)
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
    await axios.get(`${dispatcherURL}/v1/map/at/${targetRow}/${targetCol}`)
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
    while (car.position.row !== targetRow)
        await tryToMoveCar(car, car.position.row + rowStep, car.position.col);
    while (car.position.col !== targetCol)
        await tryToMoveCar(car, car.position.row, car.position.col + colStep);
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
async function loadTerminal(car) {
    // Машинка кладёт весь свой багаж в терминал)
    await car.luggage.forEach(luggage_item => {
        luggageTerminal.push(luggage_item);
    });
    // И очищается духовно
    car.luggage = [];
    console.log(`${new Date()} Машинка ${car.id} из Baggage Tractor выгрузила в терминал весь багаж, связанный с рейсом ${flightID}`);
}

// Принятие багажа из регистрации (очередь)
function acceptLuggageFromRegistration(req, res) {
    // Нихасю очередь... :(
    // Но здесь будет очередь...
    const luggageObj = req.body;
    if (luggageObj.id && luggageObj.passenger_id && luggageObj.flight_id) {
        luggageTerminal.push(luggageObj);
        res.status(200).send('');
        console.log(`${new Date()} Baggage Tractor принял багаж от сервиса регистрации: ${req.body}`);
    } else {
        console.log(`${new Date()} Baggage Tractor получил от регистрации неправильный багаж, поэтому проигнорирова его`);
        res.status(400).send('Wrong format!');
    }
}

// Выгрузка багажа из машинки в самолёт
async function loadPlane(car, plane) {
    await axios.post(`${planeURL}/v1/luggage/load`,
               car.luggage,
               { headers: { Accept: "application/json" } })
        .then(response => {
            console.log(`Машинка ${car.id} загрузила багаж на самолёт ${plane.id}, ответ: `, response);
            car.luggage = [];
        })
        .catch(err => {
           console.log(`${new Date()} В процессе загрузки самолёта багажом машинкой ${plane.id} возникла ошибка: `, err);
        });
}

// Выгрузка багажа из самолёта в машинку
async function unloadPlane(car, plane) {
    await axios.post(`${planeURL}/v1/luggage/unload`,
               { headers: { Accept: "application/json" } })
        .then(response => {
            car.luggage = response.data;
            console.log(`Машинка ${car.id} разгрузила самолёт ${plane.id}, ответ: `, response);
        })
        .catch(err => {
            console.log(`${new Date()} В процессе разгрузки самолёта машинкой ${plane.id} возникла ошибка: `, err);
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
    console.log(`${new Date()} Baggage Tractor отправил данные о машинках визуализатору`);
}

// ГЛАВНОЕ: Обработка запроса УНО
async function handleHSRequest(req, res) {
    const flightID = req.params.id;
    console.log(`${new Date()} Baggage Tractor получил запрос от Handling Supervisor обслужить самолёт по рейсу ${flightID}`);

    // Здесь запрашиваю свойства самолёта
    // TODO: согласовать свойства самолёта
    let planeID;
    let parkingSpot;
    let planeRow;
    let planeCol;
    let planeFlightType;
    console.log(`${new Date()} Baggage Tractor запрашивает данные по рейсу ${flightID} у микросервиса Board`);
    await axios.get(`${planeURL}/v1/airplane/${flightID}`)
        .then(response => {
            const planeData = response.data.airplane;

            planeID = planeData.id;
            parkingSpot = parseInt(planeData.parking_spot);
            // planeRow = planeData.position.row;
            // planeCol = planeData.position.col;
            planeRow = carRoutes.parkingSpots[parkingSpot - 1][0];
            planeRow = carRoutes.parkingSpots[parkingSpot - 1][1];

            planeFlightType = planeData.flight_type;
            console.log(`${getTimestamp()} Baggage Tractor получил от микросервиса Board данные о самолёте ${flightID}`);
        })
        .catch((err) => {
            console.log(`${getTimestamp()} В процессе запроса данных о самолёте ${flightID} возникла ошибка!`, err);
        });
    // Проверка, есть ли свободные машинки
    const freeCars = luggageCars.some(car => { car.status === 'ready'; });
    // Если свободных машинок нет
    if (!(freeCars)) {
        console.log(`${getTimestamp()} Baggage Tractor не имеет свободных машинок и сообщает об этом Handling Supervisor`);
        res.status(400).send('No free cars!');
      // Если есть свободные машинки
    } else {
        // Нахождение ближайшей к выездной точке
        let nearestCarID;
        let maxCol = -1;
        for (let i = 0; i < luggageCars.length; i++) {
            if (luggageCars[i].position.col > maxCol) {
                maxCol = luggageCars[i].position.col;
                nearestCarID = luggageCars[i].id;
            }
        }
        // Отправляю нужный ответ УНО
        res.status(200).send(nearestCarID);
        console.log(`${getTimestamp()} Baggage Tractor принял запрос от УНО обслужить самолёт ${flightID} и отправил машинку ${nearestCarID} работать`);

        // Здесь уже начинаю движение
        const currentCar = luggageCars[await findIndexWithKey(nearestCarID)];
        currentCar.status = 'busy';


        // Тачка едет до точки отъезда и по первым двум дорожкам
        await moveCarToPointUnrouted(currentCar, carRoutes.dispatchRow, carRoutes.dispatchCol);
        await moveCarThroughRoute(currentCar, carRoutes.road_1);
        await moveCarThroughRoute(currentCar, carRoutes.road_2);
        // Далее мне нужно понять, прилетает ли самолёт или улетает.
        // Если самолёт улетает, то машинка сначала едет до терминала, потом до самолёта
        // передаёт УНО успех и потом на стоянку.
        if (planeFlightType === 'takeoff') {
            await unloadTerminal(currentCar, flightID);

            await moveCarThroughRoute(currentCar, carRoutes.road_3);

            await moveCarToPointUnrouted(currentCar,
                                         carRoutes.planeZoneRow,
                                         carRoutes.planeZoneCol);               // Дальше крадется до середины площадки
            await moveCarToPointUnrouted(currentCar, planeRow, planeCol);   // Потом к самому самолёту
            await loadPlane(currentCar, planeID);                               // Загружает самолёт
            // TODO: я кидаю успех для УНО здесь или уже когда вернусь на парковку?
            // Дальше снова до центра площадки
            await moveCarToPointUnrouted(currentCar, carRoutes.planeZoneRow, carRoutes.planeZoneCol);
            // Дальше крадётся до точки выезда
            await moveCarToPointUnrouted(currentCar, carRoutes.returnRow, carRoutes.returnCol);

            await moveCarThroughRoute(currentCar, carRoutes.road_4);
            await moveCarThroughRoute(currentCar, carRoutes.road_5);
            await moveCarThroughRoute(currentCar, carRoutes.road_6);

        // Если прилетает то машинка сначала едет до самолёта по обратному маршруту, разгружает его,
        // едет до терминала и выкидывает всё в пустоту (ладно),
        // кидаю запрос УНО о выполнении задания
        // и возвращается на стоянку по
        } else {
            await moveCarThroughRoute(currentCar, carRoutes.road_3);
            // Дальше крадется до середины площадки
            await moveCarToPointUnrouted(currentCar, carRoutes.planeZoneRow, carRoutes.planeZoneCol);
            // Потом к самому самолёту
            await moveCarToPointUnrouted(currentCar, planeRow, planeCol);
            // Разгружает самолёт
            await unloadPlane(currentCar, planeID);
            // Дальше снова до центра площадки
            await moveCarToPointUnrouted(currentCar, carRoutes.planeZoneRow, carRoutes.planeZoneCol);
            // Дальше крадётся до точки выезда
            await moveCarToPointUnrouted(currentCar, carRoutes.returnRow, carRoutes.returnCol);
            // Дальше едет по 4, 5
            await moveCarThroughRoute(currentCar, carRoutes.road_4);
            await moveCarThroughRoute(currentCar, carRoutes.road_5);
            await moveCarThroughRoute(currentCar, carRoutes.road_6);
            await moveCarThroughRoute(currentCar, carRoutes.road_2);
            // Выгружает багаж
            await loadTerminal(currentCar);
            // Кружок
            await moveCarThroughRoute(currentCar, carRoutes.road_8);
            await moveCarThroughRoute(currentCar, carRoutes.road_5);
            await moveCarThroughRoute(currentCar, carRoutes.road_6);
        }
        // И садится жопой на своё место.
        await moveCarToPointUnrouted(currentCar, currentCar.home.row, currentCar.home.col);
        currentCar.status = 'ready';
    }
}

function changeSpeed(req, res) {
    let reqTimeout;
    try {
        reqTimeout = req.params.timeout;
        eventTimeout = reqTimeout;
        console.log(`${new Date()} Baggage Tractor сменил скорость симуляции`);
    } catch(err) {
        console.log(`${new Date()} В процессе смены скорости симуляции возникла ошибка!`);
    }
}

async function handleHSRequestPlug() {
    await moveCarToPointUnrouted(currentCar, carRoutes.dispatchRow, carRoutes.dispatchCol);
    await moveCarThroughRoute(currentCar, carRoutes.road_1);
    await moveCarThroughRoute(currentCar, carRoutes.road_2);
    // await unloadTerminal(currentCar, flightID);

    await moveCarThroughRoute(currentCar, carRoutes.road_3);

    await moveCarToPointUnrouted(currentCar, carRoutes.planeZoneRow, carRoutes.planeZoneCol); // Дальше крадется до середины площадки
    await moveCarToPointUnrouted(currentCar, planeRow, planeCol);           // Потом к самому самолёту
    // await loadPlane(currentCar, planeID);                               // Загружает самолёт
    // TODO: я кидаю успех для УНО здесь или уже когда вернусь на парковку?
    // Дальше снова до центра площадки
    await moveCarToPointUnrouted(currentCar, carRoutes.planeZoneRow, carRoutes.planeZoneCol);
    // Дальше крадётся до точки выезда
    await moveCarToPointUnrouted(currentCar, carRoutes.returnRow, carRoutes.returnCol);

    await moveCarThroughRoute(currentCar, carRoutes.road_4);
    await moveCarThroughRoute(currentCar, carRoutes.road_5);
    await moveCarThroughRoute(currentCar, carRoutes.road_6);
}


module.exports = {
    luggageTerminal,
    spawnNewCar,
    acceptLuggageFromRegistration,
    handleVisuals,
    handleHSRequest,
    changeSpeed,
}
