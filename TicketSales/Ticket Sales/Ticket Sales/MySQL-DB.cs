using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml.Linq;
using MySql.Data.MySqlClient;

namespace Ticket_Sales
{
    internal class MySQL_DB
    {
            public MySqlConnection connect = new MySqlConnection("server = localhost; port = 3306; username = root; password = my_sql_root_PWD; database = ticket_sales");
            public void OpenConnect()
            {
                try
                {
                    if (connect.State == System.Data.ConnectionState.Closed)
                    {
                        connect.Open();
                    }
                    else
                    {
                        Console.WriteLine("Already opened");
                    }
                }
                catch (Exception ee)
                {
                    Console.WriteLine(ee.Message);
                }

            }
            public void CloseConnect()
            {
                try
                {
                    if (connect.State == System.Data.ConnectionState.Open)
                    {
                        connect.Close();
                    }
                    else
                    {
                        Console.WriteLine("Already closed");
                    }
                }
                catch (Exception e)
                {
                    Console.WriteLine($"PROBLEM: {e.Message}");
                }
            }

            public MySqlConnection GetConnection()
            {
                try
                {
                    return connect;
                }
                catch (Exception ee)
                {
                    Console.WriteLine(ee.Message);
                    return null;
                }
            }

        internal void FillSeats()
        {
            var client = new HttpClient();
            try
            {
                var response = client.GetAsync($"http://46.174.48.185:9111/flights").Result;
                if (response.IsSuccessStatusCode)
                {
                    string result = response.Content.ReadAsStringAsync().Result;
                    string[] flight_info = result.Split(',');
                    get_INFO("id", flight_info);
                }
                else
                {
                    Console.WriteLine(response.ToString());
                }
            }
            catch (Exception ee)
            {
                Console.WriteLine(ee.Message);
            }

        }

        internal bool CheckSeats(string flight_GUID)
        {   
                MySQL_DB db = new MySQL_DB();
                string seats = "";
                MySqlCommand cmd = new MySqlCommand("SELECT `FREE_SEATS` FROM `Flights` WHERE `FLIGHT_GUID` = @N ", db.GetConnection());
                cmd.Parameters.Add("@N", MySqlDbType.VarChar).Value = flight_GUID;

                try { 
                    db.OpenConnect();
                    MySqlDataReader reader = cmd.ExecuteReader();
                    if (reader.HasRows)
                    {
                        while (reader.Read())
                        {
                            seats = reader.GetValue(0).ToString();
                        }
                    }
                    else
                    {
                       Console.WriteLine("Not Found");
                    }
                } 
                    catch (Exception e)
                    { 
                       Console.WriteLine($"Ошибка {e.Message}");
                    }
                    finally
                    {
                   db.CloseConnect();
                }

                int free_seets = 0;
            
                int.TryParse(seats, out free_seets);

                if(free_seets > 0)
                {
                    MySqlCommand cmd2 = new MySqlCommand($"UPDATE `Flights` SET `FREE_SEATS` = @n WHERE `FLIGHT_GUID` = @a", db.GetConnection());
                    cmd2.Parameters.Add("@n", MySqlDbType.VarChar).Value = free_seets-1;
                    cmd2.Parameters.Add("@a", MySqlDbType.VarChar).Value = flight_GUID;
                db.OpenConnect();
                    cmd2.ExecuteNonQuery();
                    db.CloseConnect();
                    return true;
                }
                if(free_seets == 0) 
                { 
                    return false;
                }

                return false;
        }

        static string[] Parcer(string message)
        {
            message = message.Trim('\n');
            string[] info_passenger = message.Split(';');
            return info_passenger;
        }

        public static void get_INFO(string name, string[] info_passenger)
        {
            MySQL_DB db = new MySQL_DB();
            db.OpenConnect();
            //MySqlCommand cmd = new MySqlCommand($"INSERT INTO `Flights` (`FLIGHT_GUID`, `FREE_SEATS`) VALUES(@n, @a)", db.GetConnection());
            //cmd.Parameters.Add("@n", MySqlDbType.VarChar).Value = info_passenger[0].Split(':')[2].Trim('"');
            //cmd.Parameters.Add("@a", MySqlDbType.VarChar).Value = info_passenger[8].Split(':')[1].Trim('"', '}');
            //cmd.ExecuteNonQuery();

            for (int i = 0; i < info_passenger.Length; i++)
            {
                if (info_passenger[i].ToLower().Contains("id") && info_passenger[i + 8].ToLower().Contains("airplane_capacity"))
                {
                    try
                    {
                        MySqlCommand cmd2 = new MySqlCommand($"INSERT INTO `Flights` (`FLIGHT_GUID`, `FREE_SEATS`) VALUES(@n, @a)", db.GetConnection());
                        cmd2.Parameters.Add("@n", MySqlDbType.VarChar).Value = info_passenger[i].Split(':')[1].Trim('"');
                        cmd2.Parameters.Add("@a", MySqlDbType.VarChar).Value = info_passenger[i + 8].Split(':')[1].Trim('"', '}');
                        cmd2.ExecuteNonQuery();
                    }
                    catch (Exception ex) 
                    {
                        Console.WriteLine("ERROR: "+ex.Message);
                    }
                    }
            }
            db.CloseConnect();
        }

    }

}
