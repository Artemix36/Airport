using RabbitMQ.Client;

namespace Ticket_Sales
{
    internal class MQ
    {
        static public void Main()
        {
            MQ_connector MQ = new MQ_connector();
            Thread listener = new Thread(() => ReceiveIndividualMessage(MQ));
            listener.Start();

        }

        static private void SendMsg(MQ_connector MQ)
        {
            Console.WriteLine("Введите сообщение");
            string message = Console.ReadLine();

            if (message != null || message.Length >= 0)
            {
                MQ.SendMessage(message);
            }
            else
            {
                Console.WriteLine("Не введено");
            }

        }
        static private void ReceiveIndividualMessage(MQ_connector MQ)
        {
            Console.WriteLine("Listener thread started - it will check for new customer once in 5 seconds!");
            while (true)
            {
                Thread.Sleep(5000);
                MQ.ReceiveIndividualMessage();
            }
        }
    }
}