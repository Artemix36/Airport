const amqp = require('amqplib');
const utils = require('./utils');

const rabbitURL = 'amqps://itojxdln:DEL8js4Cg76jY_2lAt19CjfY2saZT0yW@hawk.rmq.cloudamqp.com/itojxdln';
const rabbitKey = 'RegistrationToBaggageKey';

async function startRabbit() {
    try {
        const connection = await amqp.connect(rabbitURL);
        const channel = await connection.createChannel();

        const queue = 'RegistrationToBaggage';
        await channel.assertQueue(queue, { durable: false });
        await channel.bindQueue(queue, 'PassengersExchange', rabbitKey)
        console.log(`Проинициализирована очередь, ожидается поступление багажа...`);

        channel.consume(queue, (message) => {
            if (message !== null) {
                const jsonData = JSON.parse(message.content.toString());
                console.log(`Получен новый багаж из очереди: `, jsonData);

                // Добавление поступившего багажа в терминал
                utils.luggageTerminal.push({
                    passenger_id: jsonData.Passenger,
                    flight_id: jsonData.Voyage
                });

                channel.sendToQueue(message.properties.replyTo, Buffer.from('Success'), {
                    correlationId: message.properties.correlationId
                });
                channel.ack(message);
            }
        });
    } catch (error) {
        console.error(`Ошибка в очереди: `, error);
    }
}

module.exports = {
    startRabbit,
};
