using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Channels;
using System.Threading.Tasks;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Ticket_Sales
{
    internal class MQ_connector
    {

        static string exchangeName = "Efim-Test";
        static string queueName = "Efim";
        static ConnectionFactory factory = new ConnectionFactory
        {
            UserName = "guest",
            Password = "guest",
            VirtualHost = "/",
            HostName = "localhost"
        };
        static IConnection conn = factory.CreateConnection();
        static string routingKey = "efim-test";

        //private IConnection GetRabbitConnection()
        //{
        //    ConnectionFactory factory = new ConnectionFactory
        //    {
        //        UserName = "guest",
        //        Password = "guest",
        //        VirtualHost = "/",
        //        HostName = "localhost"
        //    };
        //    try
        //    {
        //        IConnection conn = factory.CreateConnection();
        //        return conn;
        //    }
        //    catch (Exception ex)
        //    {
        //        Console.WriteLine("Ошибка создания подключения: " + ex.Message);
        //        return null;
        //    }
        //}

        public void QueueListen()
        {
            Console.WriteLine("thread started");
            IModel model = GetRabbitChannel();
            model.QueueBind(queueName, exchangeName, routingKey);
            var subscription = new EventingBasicConsumer(model);

            while (true)
            {
                subscription.Received += (model, ea) =>
                {
                    var body = ea.Body.ToArray();
                    var message = Encoding.UTF8.GetString(body);
                    Console.WriteLine("Received: {0}", message);
                };
            }
        }
        public void CloseCon()
        {
            IModel model = GetRabbitChannel();
            if (model != null)
            {
                model.Close();
            }
            if (conn != null)
            {
                conn.Close();
            }
            Console.WriteLine("Соединение закрыто. See you, space cowboy!");
        }

        private IModel GetRabbitChannel()
        {
            if (conn != null)
            {
                IModel model = conn.CreateModel();
                model.ExchangeDeclare(exchangeName, ExchangeType.Direct);
                model.QueueDeclare(queueName, false, false, false, null);
                model.QueueBind(queueName, exchangeName, routingKey, null);
                return model;
            }
            else
            {
                return null;
            }
        }

        public void SendMessage(string message)
        {
            IModel model = GetRabbitChannel();
            if (model != null)
            {
                byte[] messageBodyBytes = Encoding.UTF8.GetBytes(message);
                model.BasicPublish(exchangeName, routingKey, null, messageBodyBytes);
                Console.WriteLine("Положено в очередь");
            }
            else
            {
                Console.WriteLine("Невозможно отправить сообщение");
            }
        }

        public void ReceiveIndividualMessage()
        {
            string originalMessage = "";
            IModel model = GetRabbitChannel();
            //BasicGetResult result = model.BasicAck(, false);

            //if (result == null)
            //{
            //    Console.WriteLine("Очередь пустая");
            //}
            //else
            //{
            //    byte[] body = result.Body.ToArray();
            //    originalMessage = Encoding.UTF8.GetString(body);
            //}
            //return originalMessage;

            using (model)
            {
                model.QueueDeclare(queue: "task_queue",
                                     durable: true,
                                     exclusive: false,
                                     autoDelete: false,
                                     arguments: null);

                model.BasicQos(prefetchSize: 0, prefetchCount: 1, global: false);
                model.ConfirmSelect();

                Console.WriteLine(" [*] Waiting for messages.");

                var consumer = new EventingBasicConsumer(model);
                consumer.Received += (chanel, ea) =>
                {
                    var body = ea.Body;
                    var message = Encoding.UTF8.GetString(body.ToArray());
                    Console.WriteLine(" [x] Received {0}", message);

                    model.BasicAck(deliveryTag: ea.DeliveryTag, multiple: false);
                    Console.WriteLine(" [x] Done");
                };

                Console.WriteLine(" Press [enter] to exit.");
                Console.ReadLine();
            }

        }
    }
}
