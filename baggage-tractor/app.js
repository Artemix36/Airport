const express = require('express');
const rabbit = require('./rabbit');
const utils = require('./utils');

const PORT = 9001;
const carsCount = 3;


const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

for (let i = 0; i < carsCount; i++)
    utils.spawnNewCar();
let ending;
if ((carsCount === 1) || ((carsCount > 20) && (carsCount % 10 === 1)))
    ending = "ку";
else if ((carsCount === 0) || (carsCount < 5) || (carsCount > 20))
    ending = "ки";
else
    ending = "ок";


console.log(`${new Date()} Микросервис Baggage Tractor проинициализировал ${carsCount} машин${ending}!`);

// В ответ на запрос визуализатора отсылаю своё состояние
app.get('/v1/visuals', utils.handleVisuals);
// Обработка запроса на смену скорости системыы
// app.get('/v1/speed/:timeout', utils.changeSpeed);

// На POST-запрос со стороны микросервиса "Регистрация" я добавляю багаж в багажный терминал
// app.post('/v1/terminal', utils.acceptLuggageFromRegistration);

// На запрос УНО я начинаю движение к самолёту
app.get('/v1/go_parking/:id', utils.handleHSRequest);

// На запрос УНО о начале действия я начинаю действие
app.post('/v1/do_action/:id', utils.doAction);

app.listen(PORT, err => {
    if (err) console.log(err);
    console.log(`${new Date()} Микросервис Baggage Tractor начал прослушку порта ${PORT}.`);
});
rabbit.startRabbit();
