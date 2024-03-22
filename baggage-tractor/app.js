const express = require('express');
const rabbit = require('./rabbit');
const utils = require('./utils');

const PORT = 9001;


const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// В ответ на запрос визуализатора отсылаю своё состояние
app.get('/v1/visuals', utils.handleVisuals);

// TODO: пока не используется
app.get('/v1/speed/:timeout', utils.changeSpeed);

// На запрос УНО я начинаю движение к самолёту
app.get('/v1/go_parking/:plane_id', utils.goParking);

// На запрос УНО о начале действия я начинаю действие
app.post('/v1/do_action/:car_id', utils.doAction);

// Для дебага
// app.get('/v1/debug/carts', utils.debugGetCarts);
// app.get('/v1/debug/luggage', utils.debugGetLuggage);
// app.post('/v1/debug/luggage', utils.debugPostLuggage);

app.listen(PORT, err => {
    if (err) console.log(err);
    console.log(`Сервис запущен! Начата прослушка порта ${PORT}...`);
});
rabbit.startRabbit();

