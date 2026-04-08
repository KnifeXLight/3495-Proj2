import mysql.connector
from pymongo import MongoClient
import time
import os

# Helper to connect to MySQL (Raw Data)
def get_mysql_connection():
    return mysql.connector.connect(
        host=os.environ.get('DB_HOST'),
        user=os.environ.get('DB_USER'),
        password=os.environ.get('DB_PASSWORD'),
        database=os.environ.get('DB_NAME')
    )

# Helper to connect to MongoDB (Processed Stats)
def get_mongo_connection():
    client = MongoClient(
        host=os.environ.get('MONGO_HOST'),
        port=27017,
        username=os.environ.get('MONGO_USER'),
        password=os.environ.get('MONGO_PASSWORD')
    )
    return client['analytics_db']

def run_analytics():
    print("Running analytics job...", flush=True)
    try:
        # 1. Read Raw Data from MySQL
        mysql_conn = get_mysql_connection()
        cursor = mysql_conn.cursor(dictionary=True)
        cursor.execute("SELECT data_value FROM raw_data")
        rows = cursor.fetchall()
        cursor.close()
        mysql_conn.close()

        if not rows:
            print("No data found in MySQL. Skipping.", flush=True)
            return

        # Extract values into a list
        values = [row['data_value'] for row in rows]
        
        # 2. Calculate Statistics
        stats = {
            "max": max(values),
            "min": min(values),
            "avg": round(sum(values) / len(values), 2),
            "count": len(values),
            "timestamp": time.time()
        }
        print(f"Calculated stats: {stats}", flush=True)

        # 3. Write Results to MongoDB
        mongo_db = get_mongo_connection()
        collection = mongo_db['statistics']
        collection.insert_one(stats)
        print("Stats successfully saved to MongoDB.", flush=True)

    except Exception as e:
        print(f"Error during analytics run: {e}", flush=True)

if __name__ == "__main__":
    print("Starting Analytics Background Service...")
    # Give the databases a few seconds to fully boot up before the first run
    time.sleep(10) 
    
    # Run the job periodically (e.g., every 30 seconds)
    while True:
        run_analytics()
        time.sleep(30)