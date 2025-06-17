from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import GPT2LMHeadModel, GPT2Tokenizer
import torch
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
MODEL_PATH = "./gpt2" 
model = GPT2LMHeadModel.from_pretrained(MODEL_PATH)
tokenizer = GPT2Tokenizer.from_pretrained(MODEL_PATH)
tokenizer.pad_token = tokenizer.eos_token
SENSITIVE_CATEGORIES = {
    "Financial & Business Information": [
        "revenue", "profit margin", "financial statements", "valuation", "charges", "cost","payout","charges","charge",
        "budget", "expenses", "investment", "operating costs", "R&D spending", "cash flow", "EBITDA", "earnings"
    ],
    "Legal & Compliance Issues": [
        "lawsuit", "court order", "policy violation", "nda", "regulation", "compliance", "settlement",
        "litigation", "legal dispute", "government investigation", "intellectual property", "copyright", "patent","policies",
    ],
    "Employee & HR Data": [
        "salary", "compensation", "benefits", "layoffs", "employee records", "performance reviews",
        "personal data", "HR policies", "hiring practices", "payroll", "bonus", "severance", "workforce"
    ],
    "Security & Data Breach": [
        "cyber attack", "hacked", "data breach", "password leak", "malware", "ransomware",
        "security incident", "vulnerability", "phishing", "DDoS", "unauthorized access", "encryption"
    ],
    "Negative Reputation & Crisis Management": [
        "scandal", "fraud", "public backlash", "ceo resignation", "misconduct", "reputation damage",
        "media crisis", "negative press", "customer complaints", "bad reviews", "investigation", "corruption"
    ],
    "Operational & Strategic Information": [
        "business strategy", "market analysis", "competitive analysis", "operational efficiency",
        "internal processes", "supply chain", "inventory levels", "logistics", "strategic planning",
        "operational metrics", "business plan", "parcing","pricing"
    ],
    "Product & Service Information": [
        "product roadmap","support", "service pricing", "product features", "proprietary technology",
        "innovation", "research findings", "development plans", "technical specifications",
        "beta testing", "feature updates", "roadmap", "product backlog"
    ],
    "Customer & Client Data": [
        "customer lists", "client contracts", "usage statistics", "feedback", "purchase history",
        "loyalty programs", "personal information", "email addresses", "phone numbers", "CRM data", "human"
    ],
    "Vendor & Partner Information": [
        "supplier agreements", "partnership contracts", "vendor pricing", "service level agreements",
        "outsourcing", "third-party contracts", "procurement", "distributor agreements"
    ]
}
def detect_sensitive_query(query):
    """Detects sensitive topics based on predefined keywords."""
    query_lower = query.lower()

    for category, keywords in SENSITIVE_CATEGORIES.items():
        for keyword in keywords:
            if keyword in query_lower:
                return category

    return None
def chatbot_response(user_query):
 
    prompt = f"Question: {user_query}\nAnswer:"
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
 
    outputs = model.generate(
        **inputs,
        max_new_tokens=100,
        temperature=0.7,
        top_p=0.9,
        do_sample=True,
        pad_token_id=tokenizer.eos_token_id,
        eos_token_id=tokenizer.eos_token_id
    )
 
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    response = response.split("Answer:")[-1].strip().split("\n")[0]
    return response
@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    query = data.get("query", "").strip()

    if not query:
        return jsonify({"error": "Query is required"}), 400

    # Fallback for greetings
    greetings = ["hi", "hello", "hey", "good morning", "good evening"]
    if query.lower() in greetings:
        return jsonify({
            "response": "Hello! How can I assist you today?",
            "escalated": False
        })

    category = detect_sensitive_query(query)
    if category:
        return jsonify({
            "response": " I can't provide a response. I will connect you to a human agent.",
            "escalated": True,
            "category": category
        })

    response = chatbot_response(query)
    return jsonify({
        "response": response,
        "escalated": False
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)