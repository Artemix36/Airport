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

        public string ReceiveIndividualMessage()
        {
            string originalMessage = "";
            IModel model = GetRabbitChannel();
            BasicGetResult result = model.BasicGet(queueName, true);

            if (result == null)
            {
                Console.WriteLine("Очередь пустая");
                return null;
            }
            else
            {
                byte[] body = result.Body.ToArray();
                originalMessage = Encoding.UTF8.GetString(body);
                return originalMessage;
            }
            Console.WriteLine(originalMessage);

        }
    }
}
