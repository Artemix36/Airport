const amqp = require('amqplib');
const utils = require('./utils');

const rabbitURL = 'amqps://itojxdln:DEL8js4Cg76jY_2lAt19CjfY2saZT0yW@hawk.rmq.cloudamqp.com/itojxdln';
const rabbitKey = 'RegistrationToBaggageKey';

async function startRabbit() {
    try {
        const connection = await amqp.connect(rabbitURL);
        const channel = await connection.createChannel();

        const queue = 'RegistrationToBaggage';
        // { durable: false }
        await channel.assertQueue(queue, { durable: false });
        await channel.bindQueue(queue, 'PassengersExchange', 'RegistrationToBaggageKey')
        console.log(`${new Date()} Микросервис Baggage Tractor проинициализировал очередь и ждёт поступления багажа...`);

        channel.consume(queue, (message) => {
            if (message !== null) {
                const jsonData = JSON.parse(message.content.toString());
                console.log(`${new Date()} Baggage Tractor получил новый багаж из очереди: `, jsonData);

                // Добавление поступившего багажа в терминал
                utils.luggageTerminal.push({
                    passenger_id: jsonData.Voyage,
                    flight_id: jsonData.Passenger
                });

                channel.sendToQueue(message.properties.replyTo, Buffer.from('Success'), {
                    correlationId: message.properties.correlationId
                });
                channel.ack(message);
            }
        });
    } catch (error) {
        console.error(`${new Date()} Ошибка в очереди: `, error);
    }
}

module.exports = {
    startRabbit,
};
