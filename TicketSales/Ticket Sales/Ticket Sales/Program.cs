using RabbitMQ.Client;
using System.Threading.Tasks.Dataflow;

namespace Ticket_Sales
{
    internal class MQ
    {
        static int seconds = 5000;
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
            Console.WriteLine($"Listener thread started - it will check for new customer once in {seconds} ms!");
            while (true)
            {
                Thread.Sleep(seconds);
                string message = MQ.ReceiveIndividualMessage();

                if (message != null)
                {
                    string[] info_passenger = Parcer(message);
                    string passenger_GUID = get_INFO("passenger", info_passenger);
                    Console.WriteLine($"Обработано обращение от {passenger_GUID}");
                    string flight_GUID = get_INFO("flight", info_passenger);
                    string baggage = get_INFO("baggage", info_passenger);
                    string food = get_INFO("food", info_passenger);
                    MySQL_DB DB_conn = new MySQL_DB();
                    bool can_seat = DB_conn.CheckSeats(passenger_GUID, flight_GUID);

                }
            }
        }

        private static string get_INFO(string name, string[] info_passenger)
        {
           for(int i = 0; i< info_passenger.Length; i++)
            {
                if (info_passenger[i].ToLower().Contains(name.ToLower()))
                {
                    return info_passenger[i].Split(':')[1];
                }
            }
            return null;
        }

        static string[] Parcer(string message)
        {
            message = message.Trim('\n');
            string[] info_passenger = message.Split(';');
            return info_passenger;
        }
    }
}