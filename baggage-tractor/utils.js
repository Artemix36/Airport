// TODO: бэкап в SQLite ?
// TODO: JSON-заголовки в GET и POST-запросах?
// TODO: Ограничение на кол-во машинок?

const axios = require('axios');
const carRoutes = require('./carRoute');
const MD5 = require('crypto-js/md5');

const serverAddr = 'http://46.174.48.185';
const HSURL = `${serverAddr}:9004`;
const groundControlURL = `${serverAddr}:9007`;
const planeURL = `${serverAddr}:9008`;

// Заголовки для POST-запросов (не уверен, что нужно)
// const POST_Headers = {
//   'Content-Type': 'application/json',
//   'Accept': 'application/json'
// };

// Список машинок
let luggageCars = [];

// Список сумочек в багажном терминале
let luggageTerminal = [];

// Задержка в мс (движение машинки)
let moveTimeout = 300;
let luggageTimeout = 1000;

// Добавление новой машинки в систему
// TODO: если сразу заспавнить 2 машинки в одном месте, то будет ошибка...
async function spawnNewCar() {
    console.log(`Для Ground Control послано сообщение о появлении новой машинки на карте`);
    await axios.post(`${groundControlURL}/v1/map/at/${carRoutes.spawnRow}/${carRoutes.spawnCol}/1`, "")
        .then(async (response) => {
            if (response.data.success === true) {
                const newCar = {
                    id: MD5(Math.random().toString()).toString(),
                    position: {
                        row: carRoutes.spawnRow,
                        col: carRoutes.spawnCol
                    },
                    // direction: "up",
                    status: "ready",
                    job: {
                        plane_id: null,
                        plane_row: null,
                        plane_col: null,
                        job_type: null,
                        takeoff_flight_id: null
                    },
                    luggage: []
                };
                luggageCars.push(newCar);
                console.log(`Ground Control успешно получил сообщение о появлении новой машинки ${newCar.id} на ${carRoutes.spawnRow}, ${carRoutes.spawnCol}`);
            } else {
                console.log(`Во время сообщения Ground Control о появлении новой машинки на ${carRoutes.spawnRow}, ${carRoutes.spawnCol} возникла ошибка: `, response.data);
            }
        })
        .catch((error) => {
            console.error(`Во время сообщения Ground Control о появлении новой машинки на ${carRoutes.spawnRow}, ${carRoutes.spawnCol} возникла ошибка: `, error);
        });
}

// Освобождение машинки от работы
async function freeCar(car) {
    // Стирание машинки
    await axios.post(`${groundControlURL}/v1/map/at/${car.position.row}/${car.position.col}/0`, "")
        .then(response => {
            if (response.data.success === true) {
                console.log(`Ground Control успешно удалил машинку ${car.id} с карты`);
                luggageCars.splice(luggageCars.indexOf(car), 1);
            } else {
                console.log(`Ground Control не смог удалить машинку ${car.id} с карты`);
            }
        })
        .catch(error => {
            console.log(`Во время сообщения Ground Control об удалении машинки ${car.id} с ${car.position.row}, ${car.position.col} возникла ошибка: `, error);
        });
}

// Подфункция для перемещения машинки на заданную координату
async function moveCar(car, targetRow, targetCol) {

    // Здесь меняю направление машинки
    // if (targetRow !== car.position.row)
    //     (car.position.row < targetRow) ? car.direction = 'down' : car.direction = 'up';
    // else if (targetCol !== car.position.col)
    //     (car.position.col < targetCol) ? car.direction = 'right' : car.direction = 'left';
    console.log(`Машинка ${car.id} сообщает в Ground Control о перемещении с ${car.position.row}, ${car.position.col} на ${targetRow}, ${targetCol}.`);
    await axios.post(`${groundControlURL}/v1/map/move/${car.position.row}/${car.position.col}/${targetRow}/${targetCol}`, "")
        .then((response) => {
            if (response.data.success === true) {
                console.log(`Машинка ${car.id} успешно перемещена на клетку ${targetRow}, ${targetCol}.`);
                car.position.row = targetRow;
                car.position.col = targetCol;
            } else {
                console.log(`Во время сообщения Ground Control о перемещении машинки на ${targetRow}, ${targetCol} возникла ошибка: `, response.data);
            }
        })
        .catch(err => {
            console.error(`В процессе перемещения машинки ${car.id} на на клетку ${targetRow}, ${targetCol} возникла ошибка`);
        });
}

// Подфункция для попытки безопасного перемещения на заданную координату
async function tryToMoveCar(car, targetRow, targetCol) {
    console.log(`Запрос разрешения у Ground Control на перемещение машинки ${car.id} на ${targetRow}, ${targetCol}.`);
    await axios.get(`${groundControlURL}/v1/map/at/${targetRow}/${targetCol}`, { headers: { 'Accept': 'application/json' } })
        .then(async (response) => {
            if (response.data.success === true) {
                // Если клетка не занята
                if (response.data.state === "0") {
                    await moveCar(car, targetRow, targetCol);
                } else {
                    console.log(`Машинка ${car.id} желала переместиться на клетку ${targetRow}, ${targetCol}, но Ground Control не разрешил. После 1 секунды будет следующая попытка.`);
                    // Новый запрос выполняется рекурсивно ??????????????????????
                    await tryToMoveCar(car, targetRow, targetCol);
                }
            } else {
                console.log(`Во время запроса у Ground Control о состоянии клетки ${targetRow}, ${targetCol} возникла ошибка: `, response.data);
            }
        })
        .catch(err => {
            console.error(`В процессе перемещения машинки ${car.id} на на клетку ${targetRow}, ${targetCol} возникла ошибка: `, err);
        });
}

// Прогнать машинку по клеточкам до точки
async function moveCarToPoint(car, targetRow, targetCol) {

    let rowStep; let colStep;
    car.position.row < targetRow ? rowStep = 1 : rowStep = -1;
    car.position.col < targetCol ? colStep = 1 : colStep = -1;

    // Сначала машинка едет до нужной строки, потом до нужного столбца
    while (car.position.row !== targetRow) {
        const nextRow = car.position.row + rowStep;
        const nextCol = car.position.col;
        await new Promise(resolve => setTimeout(resolve, moveTimeout));
        if (carRoutes.criticalCells.includes([nextRow, nextCol]))
            await tryToMoveCar(car, nextRow, nextCol);
        else
            await moveCar(car, nextRow, nextCol);
    }
    while (car.position.col !== targetCol) {
        const nextRow = car.position.row;
        const nextCol = car.position.col + colStep;
        await new Promise(resolve => setTimeout(resolve, moveTimeout));
        if (carRoutes.criticalCells.includes([nextRow, nextCol]))
            await tryToMoveCar(car, nextRow, nextCol);
        else
            await moveCar(car, nextRow, nextCol);
    }
}

// Загрузка багажа в машинку из терминала
async function unloadTerminal(car, flightID) {
    await new Promise(resolve => setTimeout(resolve, luggageTimeout));
    // Машинка берёт из терминала багаж, связанный с данным конкретным рейсом
    car.luggage = luggageTerminal.filter(luggage_item => {
        luggage_item.flight_id = flightID;
    });
    // И терминал очищается от этих сумочек
    luggageTerminal = luggageCars.filter(luggage_item => {
        !(luggage_item.flight_id = flightID);
    });
    console.log(`Машинка ${car.id} забрала из терминала весь багаж, связанный с рейсом ${flightID}`);
}

// Выгрузка багажа из машинки в терминал
async function loadTerminal(car, planeID) {
    await new Promise(resolve => setTimeout(resolve, luggageTimeout));
    // Машинка кладёт весь свой багаж в терминал)
    // await car.luggage.forEach(luggage_item => {
    //     luggageTerminal.push(luggage_item);
    // });
    // И очищается духовно
    car.luggage = [];
    console.log(`Машинка ${car.id} выгрузила в терминал багаж, разгруженный из самолёта ${planeID}`);
}

// Выгрузка багажа из машинки в самолёт
async function loadPlane(car, planeID) {
    await new Promise(resolve => setTimeout(resolve, luggageTimeout));
    await axios.post(`${planeURL}/v1/airplanes/${planeID}/luggage/load`, car.luggage)
        .then(response => {
            console.log(`Машинка ${car.id} загрузила багаж на самолёт ${planeID}`);
            car.luggage = [];
        })
        .catch(err => {
           console.log(`В процессе загрузки самолёта ${planeID} багажом машинкой ${car.id} возникла ошибка: `, err);
        });
}

// Выгрузка багажа из самолёта в машинку
async function unloadPlane(car, planeID) {
    await new Promise(resolve => setTimeout(resolve, luggageTimeout));
    await axios.post(`${planeURL}/v1/airplanes/${planeID}/luggage/unload`, {})
        .then(response => {
            car.luggage = response.data;
            console.log(`Машинка ${car.id} разгрузила самолёт ${planeID}, ответ: `, response);
        })
        .catch(err => {
            console.log(`В процессе разгрузки самолёта машинкой ${planeID} возникла ошибка: `, err);
        });
}

// Обработка запроса УНО (GO_PARKING)
async function goParking(req, res) {
    // Получаю ID самолёта из запроса
    const planeID = req.params.plane_id;
    let noLuggage;
    console.log(`Получен запрос от Handling Supervisor обслужить самолёт ${planeID}`);

    // Спавн и назначение машинки
    await spawnNewCar();
    const currentCar = await luggageCars.find(car => car.status === "ready");
    currentCar.status = 'driving';

    await res.status(200).send(currentCar.id);
    console.log(`Запрос Handling Supervisor обслужить самолёт ${planeID} принят, машинка ${currentCar.id} отправлена`);

    // Запрос типа работы у самолёта
    console.log(`Запрос, что нужно сделать для самолёта ${planeID}`);
    await axios.get(`${planeURL}/v1/airplanes/${planeID}/luggage`, { headers: { 'Accept': 'application/json' } })
        .then(response => {
            if (response.data.success === true) {
                // Если true - загрузить; если false - разгрузить
                if (response.data.load === true)
                    currentCar.job.job_type = "unload";
                else
                    currentCar.job.job_type = "load";
                noLuggage = (response.data.luggage.length === 0);
            } else {
                console.log(`Получить данные о самолёте ${planeID} от Board не получилось, причина: `, response.data);
            }
        })
        .catch(error => {
            console.error(`В процессе запроса данных о самолёте ${planeID} возникла ошибка!`, error);
        });

    // API Forget
    // Если luggage пустой и разгрузить, то не надо разгружать
    if (currentCar.job.job_type === "unload" && noLuggage) {
        console.log(`Обслуживать самолёт ${planeID} не нужно, машинка ${currentCar.id} послала сигнал "forget" послан для Handling Supervisor`);
        await axios.post(`${HSURL}/v1/car/forget/${currentCar.id}}`, {})
            .then((response) => {
                console.log(`Handling Supervisor успешно получил ответ об отсутствии необходимости обслуживать самолёт ${planeID} машинкой ${currentCar.id}`);
            })
            .catch((error) => {
                console.error(`Во время отправки Handling Supervisor сообщения об отсутствии необходимости обслуживать самолёт ${planeID} машинкой ${currentCar.id} возникла ошибка: `, error);
            })
        await freeCar(currentCar);
        return;
    }

    // Запрос координат и рейса отлёта у самолёта
    console.log(`Второй запрос по самолёту ${planeID} у Board`);
    await axios.get(`${planeURL}/v1/airplanes/${planeID}`, { headers: { 'Accept': 'application/json' } })
        .then(response => {
            if (response.data.success === true) {
                const planeData = response.data.airplane;

                const parkingSpot = parseInt(planeData.parking_spot);
                currentCar.job.plane_row = carRoutes.parkingSpots[parkingSpot][0];
                currentCar.job.plane_col = carRoutes.parkingSpots[parkingSpot][1];
                currentCar.job.plane_id = planeID;
                currentCar.job.takeoff_flight_id = planeData.voyage_b_id;

                console.log(`От Board получены данные о самолёте ${planeID}`);
            } else {
                console.log(`Получить данные о самолёте ${planeID} от Board не получилось, причина: `, response.data);
            }
        })
        .catch((err) => {
            console.error(`В процессе запроса данных о самолёте ${planeID} возникла ошибка!`, err);
        });

    // Здесь уже начинаю движение;
    for (let i = 0; i < 7; i++)
        await moveCarToPoint(currentCar, carRoutes.coreCells[i][0], carRoutes.coreCells[i][1]);

    // Сообщаю об этом УНО
    currentCar.status = 'waiting';
    console.log(`Машинка ${currentCar.id} доехала до центра площадки и послала запрос Handling Supervisor об этом`);
    await axios.post(`${HSURL}/v1/car/here/${currentCar.id}`, {})
        .then((response) => {
            console.log(`Handling Supervisor успешно принял сигнал о подъезде машинки ${currentCar.id} к площадке`);
        })
        .catch((err) => {
            console.error(`Во время сообщения Handling Supervisor о подъезде машинки ${currentCar.id} возникла ошибка: `,
                            err);
        });
}

// Отправка сигнала для УНО о завершении работы машинки
async function sendDoneSignal(car) {
    console.log(`Сообщение об окончании работы машинки ${car.id} послано для Handling Supervisor`);
    await axios.post(`${HSURL}/v1/car/done/${car.id}`, {})
        .then((response) => {
            console.log(`Handling Supervisor успешно получил сигнал об окончании работы машинки ${car.id}`);
            // Это по идее даже не нужно...
            car.job.plane_id = null;
            car.job.plane_row = null;
            car.job.plane_col = null;
            car.job.job_type = null;
            car.job.takeoff_flight_id = null;
        })
        .catch((error) => {
            console.error(`В процессе сообщения Handling Supervisor об окончании работы машинки ${car.id} возникла ошибка: `, error);
        });
}

// Обработка запроса УНО (DO_ACTION)
async function doAction(req, res) {
    const carID = req.params.car_id;
    console.log(`Получен запрос "do_action" от Handling Supervisor для машинки ${carID}`);

    const currentCar = await luggageCars.find(car => car.id === carID);
    // Зачем? Такое возможно вообще?
    // if (currentCar.status !== 'waiting') {
    //     res.status(400).send('Car is not at the parking zone!');
    //     return;
    // }

    await res.status(200).send("");

    currentCar.status = 'driving';
    // Если самолётик надо разгрузить
    if (currentCar.job.job_type === "unload") {
        await moveCarToPoint(currentCar, currentCar.job.plane_row, currentCar.job.plane_col);
        await unloadPlane(currentCar, currentCar.job.plane_id);

        for (let i = 7; i < 10; i++)
            await moveCarToPoint(currentCar, carRoutes.coreCells[i][0], carRoutes.coreCells[i][1]);

        for (let i = 1; i < 3; i++)
            await moveCarToPoint(currentCar, carRoutes.coreCells[i][0], carRoutes.coreCells[i][1]);

        await loadTerminal(currentCar, currentCar.job.plane_id);
        await sendDoneSignal(currentCar);

        for (let i = 3; i < 5; i++)
            await moveCarToPoint(currentCar, carRoutes.coreCells[i][0], carRoutes.coreCells[i][1]);

        for (let i = 8; i < 11; i++)
            await moveCarToPoint(currentCar, carRoutes.coreCells[i][0], carRoutes.coreCells[i][1]);
    // Если загрузить
    } else {
        for (let i = 7; i < 10; i++)
            await moveCarToPoint(currentCar, carRoutes.coreCells[i][0], carRoutes.coreCells[i][1]);

        for (let i = 1; i < 3; i++)
            await moveCarToPoint(currentCar, carRoutes.coreCells[i][0], carRoutes.coreCells[i][1]);

        await unloadTerminal(currentCar, currentCar.job.takeoff_flight_id);

        for (let i = 3; i < 6; i++)
            await moveCarToPoint(currentCar, carRoutes.coreCells[i][0], carRoutes.coreCells[i][1]);

        await moveCarToPoint(currentCar, currentCar.job.plane_row, currentCar.job.plane_col);
        await loadPlane(currentCar, currentCar.job.plane_id);
        await sendDoneSignal(currentCar);

        for (let i = 7; i < 11; i++)
            await moveCarToPoint(currentCar, carRoutes.coreCells[i][0], carRoutes.coreCells[i][1]);
    }

    await freeCar(currentCar);
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
    // console.log(`Отправлены данные визуализатору`);
}

function changeSpeed(req, res) {
    let reqTimeout = req.params.timeout;
    console.log(`Получен запрос на смену скорости симуляции на ${reqTimeout}`);
    try {
        reqTimeout = req.params.timeout;
        eventTimeout = reqTimeout;
        console.log(`Скорость симуляции успешно сменена на ${reqTimeout}`);
        res.status(200).send("");
    } catch(err) {
        console.log(`В процессе смены скорости симуляции на ${reqTimeout} возникла ошибка!`);
        res.status(400).send("");
    }
}

// function debugGetCarts(req, res) {
//     res.status(200).send(luggageCars);
// }
//
// function debugGetLuggage(req, res) {
//     res.status(200).send(luggageTerminal);
// }
//
// function debugPostLuggage(req, res) {
//     const luggageItem = req.body;
//     console.log(`Получен новый багаж: `, luggageItem);
//     luggageTerminal.push(luggageItem);
// }

module.exports = {
    luggageTerminal,
    spawnNewCar,
    handleVisuals,
    goParking,
    doAction,
    changeSpeed,
    // debugGetCarts,
    // debugGetLuggage,
    // debugPostLuggage,
}
