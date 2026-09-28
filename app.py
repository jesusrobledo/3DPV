from flask import Flask,request,render_template, jsonify
import os
import json
import yaml

current_path = os.path.dirname(__file__)
app = Flask(__name__)

@app.route("/")
def index():
    return render_template("Main.html")

@app.route("/load_terrain", methods=["POST", "GET"])
def load_terrain():
    try:
        with open(os.path.join(current_path,"static","Terrain.terrain"),"r") as stream:
            data = yaml.safe_load(stream)
        return jsonify(data)
    except Exception as e:
        return {'ok':False}

@app.route("/load_case", methods=["POST", "GET"])
def load_case():
    try:
        with open(os.path.join(current_path,"static","Config.cfg"),"r") as stream:
            data = yaml.safe_load(stream)
        return jsonify(data)
    except Exception as e:
        return {'ok':False}

if __name__ == "__main__":
    app.run(debug=True)