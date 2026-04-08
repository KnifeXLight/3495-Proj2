from flask import Flask, request, jsonify
import mysql.connector
import os

app = Flask(__name__)

# Helper function to connect to the MySQL database
def get_db_connection():
    # 1. Grab variables strictly from the environment
    db_host = os.environ.get('DB_HOST')
    db_user = os.environ.get('DB_USER')
    db_password = os.environ.get('DB_PASSWORD')
    db_name = os.environ.get('DB_NAME')

    # 2. Safety Check: Crash if credentials are missing
    if not db_user or not db_password:
        print("CRITICAL ERROR: Database credentials missing from environment variables!", file=sys.stderr)
        sys.exit(1)

    # 3. Connect using those variables
    return mysql.connector.connect(
        host=db_host,
        user=db_user,
        password=db_password,
        database=db_name
    )
    
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = "SELECT id, username FROM users WHERE username = %s AND password = %s"
        cursor.execute(query, (username, password))
        user = cursor.fetchone()
        
        cursor.close()
        conn.close()

        if user:
            return jsonify({"message": "Login successful", "user": user}), 200
        else:
            return jsonify({"error": "Invalid credentials"}), 401
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Listen on all network interfaces inside the container on port 5000
    app.run(host='0.0.0.0', port=5000)
