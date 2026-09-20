from flask import Flask,request,render_template
import os
import json
import yaml

current_path = os.path.dirname(__file__)
app = Flask(__name__)

@app.route("/")
def index():
    return render_template("Main.html")

if __name__ == "__main__":
    app.run(debug=True)