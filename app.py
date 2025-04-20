from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

# Constants
# OPENROUTER_API_KEY = "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"
OPENROUTER_API_KEY ="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"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    messages = data.get("messages", [])

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "meta-llama/llama-3.1-8b-instruct:free",
        "messages": messages,
        "stream": False
    }

    try:
        # Send request to OpenRouter API
        res = requests.post(OPENROUTER_URL, headers=headers, json=payload)
        
        # Check if the request was successful
        if res.status_code != 200:
            return jsonify({"error": "Failed to fetch response from OpenRouter API"}), res.status_code

        llm_data = res.json()
        print(llm_data)

        # Extract response text (ensure safety)
        llm_text = llm_data.get("choices", [{}])[0].get("message", {}).get("content", "")
        
        # Clean the text by removing unwanted characters or symbols if needed
        llm_text = llm_text.replace("*", "")  # For example, removing asterisks if they exist
        print(llm_text)

        # Return the result to the frontend
        return jsonify({
            "text": llm_text
        })

    except requests.exceptions.RequestException as e:
        # Handle request-related errors
        return jsonify({"error": f"Request failed: {str(e)}"}), 500

    except Exception as e:
        # General error handling
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True)
