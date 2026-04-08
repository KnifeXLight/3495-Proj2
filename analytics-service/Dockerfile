FROM python:3.9-slim

# Set the working directory
WORKDIR /app

# Copy the requirements and install them
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Run the python script with unbuffered output (-u) for logging
CMD ["python", "-u", "analytics.py"]