const amqp = require('amqplib');
const utils = require('./utils');

async function startRabbit() {
    try {
        const connection = await amqp.connect('amqp://localhost');
        const channel = await connection.createChannel();

        const queue = 'luggage_queue';
        await channel.assertQueue(queue, { durable: false });
        console.log(`${new Date()} Микросервис Baggage Tractor проинициализировал очередь и ждёт поступления багажа...`);

        channel.consume(queue, (message) => {
            if (message !== null) {
                const jsonData = JSON.parse(message.content.toString());
                console.log(`${new Date()} Baggage Tractor получил новый багаж из очереди: `, jsonData);
                // Добавление поступившего багажа в терминал
                utils.luggageTerminal.push(jsonData);

                channel.sendToQueue(message.properTODO: экономические
    ties.replyTo, Buffer.from('Success'), {
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
