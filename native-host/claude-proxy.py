#!/Users/umutbasilgan/BrowserExtension/native-host/venv/bin/python
import json
import sys
import struct
import os
import logging
from anthropic import Anthropic

# Logging konfigurieren
logging.basicConfig(
    filename='/tmp/claude-proxy.log',
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def send_message(message):
    """Sendet eine Nachricht an Chrome."""
    try:
        message_json = json.dumps(message)
        message_bytes = message_json.encode('utf-8')
        sys.stdout.buffer.write(struct.pack('I', len(message_bytes)))
        sys.stdout.buffer.write(message_bytes)
        sys.stdout.buffer.flush()
        logging.info(f"Nachricht gesendet: {message}")
    except Exception as e:
        logging.error(f"Fehler beim Senden der Nachricht: {e}")
        raise

def read_message():
    """Liest eine Nachricht von Chrome."""
    try:
        text_length_bytes = sys.stdin.buffer.read(4)
        logging.info(f"Länge gelesen: {len(text_length_bytes)} bytes")
        
        if len(text_length_bytes) == 0:
            logging.info("Keine Daten empfangen")
            return None
        
        text_length = struct.unpack('i', text_length_bytes)[0]
        logging.info(f"Erwartete Nachrichtenlänge: {text_length}")
        
        text_bytes = sys.stdin.buffer.read(text_length)
        text = text_bytes.decode('utf-8')
        message = json.loads(text)
        logging.info(f"Nachricht empfangen: {message}")
        return message
    except Exception as e:
        logging.error(f"Fehler beim Lesen der Nachricht: {e}")
        raise

def main():
    logging.info("Native Host started")
    while True:
        try:
            message = read_message()
            if message is None:
                logging.info("No message received, exiting")
                break

            logging.info(f"Processing message: {message}")
            
            # Get API Key from message
            api_key = message.get('apiKey')
            if not api_key:
                raise ValueError("No API Key found in message")

            # Get System Prompt from message
            system_prompt = message.get('systemPrompt')
            logging.info(f"Using System Prompt: {system_prompt[:100]}...") # Log first 100 chars of prompt
            
            if not system_prompt:
                system_prompt = """You are a flexible LinkedIn communication partner...""" # Default prompt
                logging.info("Using default System Prompt")

            # Initialize Anthropic client with provided API Key
            anthropic = Anthropic(api_key=api_key)
            
            # Send request to Claude with provided System Prompt
            logging.info("Sending request to Claude API")
            response = anthropic.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4000,
                system=system_prompt,
                messages=[{
                    "role": "user",
                    "content": message.get('text', '')
                }]
            )

            logging.info(f"Claude response received: {response.content}")

            # Send response back to Chrome
            send_message({
                "result": response.content[0].text
            })

        except Exception as e:
            logging.error(f"Error in main loop: {e}")
            try:
                send_message({
                    "error": str(e)
                })
            except:
                logging.error("Could not send error message")
            break

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        logging.error(f"Kritischer Fehler: {e}")
        sys.exit(1)
