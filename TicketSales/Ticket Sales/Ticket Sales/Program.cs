using RabbitMQ.Client;

namespace Ticket_Sales
{
    internal class MQ
    {
        static public void Main()
        {
            MQ_connector MQ = new MQ_connector();
            while (true)
            {
                Console.WriteLine("Что вы хотите сделать?\n1 - Отправить сообщение\n2 - Прочитать сообщение\n3 - Выйти");
                int n = 0;
                int.TryParse(Console.ReadLine(), out n);
                if(n==1)
                {
                    SendMsg(MQ);
                }
                if(n == 2)
                {
                    ReceiveIndividualMessage(MQ);
                }
                if(n == 3)
                {
                    break;
                }
            }
            MQ.CloseCon("Efim-Test", "Efim", "efim-test");
        }

        static private void SendMsg(MQ_connector MQ)
        {
            Console.WriteLine("Введите сообщение");
            string message = Console.ReadLine();

            if (message != null || message.Length >= 0)
            {
                MQ.SendMessage("Efim-Test", "Efim", "efim-test", message);
            }
            else
            {
                Console.WriteLine("Не введено");
            }

        }
        static private void ReceiveIndividualMessage(MQ_connector MQ)
        {
            Console.WriteLine(MQ.ReceiveIndividualMessage("Efim-Test", "Efim", "efim-test"));
        }
    }
}