import sys
import json
import hashlib
import os
from timeit import default_timer as timer

import jsonpickle
from flask import Flask, jsonify, request, session, make_response
from flask_cors import CORS, cross_origin
from flask_session import Session

import bipdyngraph.PyDotBipartiteLayout as PyDotBipartiteLayout
import bipdyngraph.PydotBipartiteLayoutThreeLayers as PydotBipartiteLayoutThreeLayers
import bipdyngraph.DotLayoutParser as DotLayoutParser
from bipdyngraph.BipDynGraph import BipartiteDynGraph

# import backend.clustering as clustering
import clustering as clustering
from networkMeasures import GraphMeasureComputer

app = Flask(__name__)

SECRET_KEY = "jzefozefozenfoz"
SESSION_TYPE = 'filesystem'
app.config.from_object(__name__)
# app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # or 'None'
# app.config['SESSION_COOKIE_SAMESITE'] = 'None'  # or 'None'
app.config["SESSION_COOKIE_SAMESITE"] = "None"
app.config["SESSION_COOKIE_SECURE"] = True
# app.config["SESSION_PERMANENT"] = True
Session(app)
CORS(app)
# CORS(app, supports_credentials=True)

SAVE_LAYOUT = True
# SAVE_LAYOUT = False
# same_person_weight = 1
SAME_PERSON_WEIGHT = 10000

# PERSON_ALIGN = True
PERSON_ALIGN = False


def process_data(json_data):
    graph = BipartiteDynGraph(json_data)


    # TODO: DISABLED FOR BENCHMARK
    # print("Compute network measures")
    # measure_compute = GraphMeasureComputer()
    # measure_compute.run(graph)
    # measure_compute.update_json(json_data["nodes"])

    start = timer()
    print("load data")
    layout_bipartite = PyDotBipartiteLayout.PydotBipartiteLayout(graph, SAME_PERSON_WEIGHT, PERSON_ALIGN)
    # layout_bipartite = PydotBipartiteLayoutThreeLayers.PydotBipartiteLayoutThreeLayers(graph)
    print("build dot graph")
    layout_bipartite.run()
    end = timer()
    print("TT ", end - start)

    print("set dotlayout session")
    session["dotlayout"] = layout_bipartite.to_json()
    if True:
        print("dump")
        layout_bipartite.dump_dot("./layouts/", True, extra_name=session.get("data_name"))

    dot_parser = DotLayoutParser.DotLayoutParser(layout_bipartite, graph)
    print("compute layout")
    # Pydot layout
    dot_parser.run()

    # Sugiyama layout
    # dot_parser.build_nx_graph()
    # dot_parser.compute_sugiyama_coordinates(maxiter=500, hgap=15)

    print("To Json")
    json_graph = dot_parser.to_json()

    return json_graph


def pydot_layout_to_temporal_layout_json(pydot_layout, graph):
    dot_parser = DotLayoutParser.DotLayoutParser(pydot_layout, graph)
    print("compute layout")
    dot_parser.run()

    # Sugiyama layout
    # dot_parser.build_nx_graph()
    # dot_parser.compute_sugiyama_coordinates(maxiter=500, hgap=15)

    print("To Json")
    json_graph = dot_parser.to_json()
    return json_graph


def temporal_layout(json_data):
    hash = hashlib.md5(str(json_data).encode("utf-8")).hexdigest()
    path = f"layouts/{hash}.json"
    if os.path.isfile(path) and SAVE_LAYOUT:
        with open(path) as file:
            layout_json_data = json.load(file)
    else:
        layout_json_data = process_data(json_data)
        with open(path, "w") as f:
            json.dump(layout_json_data, f)
    return layout_json_data


@app.route("/", methods=["GET"])
def base():
    message = {"message": "endpoint"}
    return jsonify(message), 200


def milan_data():
    fp = "data/Rolla_2modes.json"
    with open(fp) as file:
        json_data = json.load(file)
    return json_data

def MB_data():
    # fp = "data/MB_Paohvis_test.json"
    fp = "data/Marie_Boucher.json"
    with open(fp) as file:
        json_data = json.load(file)
    return json_data

# TODO: load data button
def generator_data():
    fp = "data/output.json"
    # fp = "data/test_gen.json"
    # fp = "data/test_gen_2.json"
    with open(fp) as file:
        json_data = json.load(file)
    return json_data

def dufournaud_data():
    fp = "./data/Dufournaud_geoloc_1940.json"
    with open(fp) as file:
        json_data = json.load(file)
    return json_data

def HAL_INRIA_data():
    fp = "data/inria.json"
    with open(fp) as file:
        json_data = json.load(file)
    return json_data

def thesis_data():
    # fp = "./data/thesis_sociology_all_2016-2022_True.json"
    # fp = "./data/thesis_sociology_all_1985-2000_True.json"
    fp = "./data/thesis_sociology_all_2000-2010_True.json"
    with open(fp) as file:
        json_data = json.load(file)
    return json_data

def buenos_aires_data():
    fp = "./data/BuenosAires_actes_tries_modifies-2021-06-23_SPLIT_None.json"
    with open(fp) as file:
        json_data = json.load(file)
    return json_data

def vispub_data():
    # fp = "./data/vispubdata_PAOH_affiliation_cleaned_june202.json"
    # fp = "./data/vispubdata_PAOH_affiliation_cleaned_june202_filter2.json"
    # fp = "./data/vispubdata_PAOH_affiliation_cleaned_june202_filter1.json"
    # fp = "./data/vispubdata_PAOH_affiliation_cleaned_june202_filter8.json"

    #    NEW
    fp = "./data/vispubdata.json"


    with open(fp) as file:
        json_data = json.load(file)
    return json_data

def aviz_data():
    fp = "./data/aviz_ILDA_exSITU-paoh.json"
    with open(fp) as file:
        json_data = json.load(file)
    return json_data


@app.route("/getData/<string:dataset>", methods=["GET"])
@cross_origin(supports_credentials=True)
def get_data(dataset):
    if dataset == "Piemont":
        json_data = milan_data()
    elif dataset == "French_Genealogy":
        json_data = dufournaud_data()
    elif dataset == "Thesis":
        json_data = thesis_data()
    elif dataset == "Buenos_Aires":
        json_data = buenos_aires_data()
    elif dataset == "Vispubdata":
        json_data = vispub_data()
    elif dataset == "MarieBoucher":
        json_data = MB_data()
    elif dataset == "Aviz":
        json_data = aviz_data()
    elif dataset == "Generator":
        json_data = generator_data()
    elif dataset == "Inria":
        json_data = HAL_INRIA_data()

    session["graph_json"] = json_data
    session["data_name"] = dataset
    dyn_graph = temporal_layout(json_data)

    resp = make_response(jsonify(json_data, dyn_graph))
    return resp

@app.route("/updateLayout", methods=["POST"])
@cross_origin(supports_credentials=True)
def update_layout():
    persons = request.json
    graph_json = session["graph_json"]
    dot_layout_json = session["dotlayout"]

    graph = BipartiteDynGraph(graph_json)
    layout_bipartite = jsonpickle.decode(dot_layout_json, keys=True)
    # layout_bipartite = PyDotBipartiteLayout.PydotBipartiteLayout(graph, SAME_PERSON_WEIGHT, align=True, json=dot_layout_json)

    for person in persons:
        try:
            person = int(person)
        except Exception as e:
            pass
        layout_bipartite.add_person_line(person, True)

    session["dotlayout"] = layout_bipartite.to_json()
    json_final = pydot_layout_to_temporal_layout_json(layout_bipartite, graph)
    return jsonify(json_final)


@app.route("/clusteringNames", methods=["GET"])
def get_clustering_names():
    algorithms = list(clustering.ALGORITHMS.keys())
    return jsonify(algorithms)

@app.route("/clustering/<string:algorithm_name>", methods=["POST"])
def get_clustering(algorithm_name):
    graph_json = request.json
    # graph = nx.node_link_graph(graph_json)
    graph = BipartiteDynGraph(graph_json)

    graph = clustering.process_graph(graph)
    node_to_communities = clustering.bipartite_clustering(graph, algorithm_name)

    return jsonify(node_to_communities)


# @app.after_request
# def add_cors_headers(response):
#     response.headers["Access-Control-Allow-Origin"] = "http://localhost:3001"
#     response.headers["Access-Control-Allow-Credentials"] = "true"
#     response.headers["Access-Control-Allow-Headers"] = "Content-Type"
#     response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
#     return response
#
# @app.before_request
# def make_session_permanent():
#     session.permanent = True


debug = True
# debug = False
if __name__ == "__main__":
    if len(sys.argv) > 1:
        app.run(debug=debug, port=sys.argv[1])
    else:
        # app.run(debug=debug, port=10090)
        app.run(debug=debug, port=5005)
        # app.run(debug=debug, port=5005, host='0.0.0.0')
