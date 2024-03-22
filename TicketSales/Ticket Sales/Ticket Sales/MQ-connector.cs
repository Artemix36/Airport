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

        static string exchangeName = "PassengersExchange";
        static string ReadQueueName = "TicketsRequest";
        static string WriteQueueName = "TicketsToRegistration";

        static ConnectionFactory factory = new ConnectionFactory
        {
            VirtualHost = "itojxdln",
            HostName = "hawk-01.rmq.cloudamqp.com",
            Password = "DEL8js4Cg76jY_2lAt19CjfY2saZT0yW",
            UserName = "itojxdln",
            ClientProvidedName = "Ticket Sales"
        };

        static IConnection conn = factory.CreateConnection();
        static IModel model1 = conn.CreateModel();
        static string routingKey = "passengers-routing-key";

        public void QueueListen()
        {
            Console.WriteLine("thread started");
            IModel model = GetRabbitChannel(ReadQueueName);
            model.QueueBind(ReadQueueName, exchangeName, ReadQueueName+"Key");
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
        public void CloseCon(string queue)
        {
            IModel model = GetRabbitChannel(queue);
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

        public IModel GetRabbitChannel(string queue)
        {
                if (conn != null)
                {
                    IModel model = conn.CreateModel();
                    model.ExchangeDeclare(exchangeName, ExchangeType.Direct);
                    model.QueueDeclare(queue, false, false, false, null);
                    model.QueueBind(queue, exchangeName, queue + "Key", null);
                    return model;
                }
                else
                {
                    Console.WriteLine("null");
                    return null;
                }
        }

        public void SendMessage(string message)
        {
            IModel model = GetRabbitChannel(WriteQueueName);
            if (model != null)
            {
                byte[] messageBodyBytes = Encoding.UTF8.GetBytes(message);
                model.BasicPublish(exchangeName, WriteQueueName+"Key", null, messageBodyBytes);
            }
            else
            {
                Console.WriteLine("Невозможно отправить сообщение");
            }
        }

        public void SendResponseMessage(string message)
        {
            IModel model = GetRabbitChannel("TicketsResponse");
            if (model != null)
            {
                byte[] messageBodyBytes = Encoding.UTF8.GetBytes(message);
                model.BasicPublish(exchangeName, "TicketsResponse" + "Key", null, messageBodyBytes);
            }
            else
            {
                Console.WriteLine("Невозможно отправить сообщение");
            }
        }

        public string ReceiveIndividualMessage()
        {
            string originalMessage = "";
            //try
            //{

            IModel model = GetRabbitChannel(ReadQueueName);
            BasicGetResult result = model.BasicGet(ReadQueueName, true);

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

            //}
            //catch (Exception ex)
            //{
            //    Console.WriteLine(ex.Message);
            //    return null;
            //}
        }
    }
}
