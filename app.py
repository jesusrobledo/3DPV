from flask import Flask,request,render_template
import os
import json
import yaml

current_path = os.path.dirname(__file__)
app = Flask(__name__)

@app.route("/")
def index():
    return render_template("Main3.html")

@app.route("/load_shader_code", methods=["POST", "GET"])
def load_shader_code():
    data = request.get_json()
    with open(
        os.path.join(current_path, "static/shaders", data["shaderFile"]), "r"
    ) as stream:
        shaderData = yaml.safe_load(stream)
    return json.dumps(
        {
            "attributes": shaderData["attributes"],
            "uniforms": shaderData["uniforms"],
            "vertexShader": shaderData["vertexShader"],
            "fragmentShader": shaderData["fragmentShader"],
        }
    )

if __name__ == "__main__":
    app.run(debug=True)