import json
from timeit import default_timer as timer

import networkx as nx
import igraph as ig
from bs4 import BeautifulSoup
from igraph import BoundingBox

from bipdyngraph.globals import ENTITYTYPE_KEY, EDGETYPE_KEY, TIME_KEY


class DotLayoutParser:
    def __init__(self, dot_layout, bip_dyn_graph):
        self.dot_layout = dot_layout
        self.bip_dyn_graph = bip_dyn_graph
        self.nodes = {}
        self.edges = []
        self.nodes_dedoubled = None
        self.edges_dedoubled = None

        self.CANVAS_DIMS = [1000, 1000]

        self.json_data = None

    def run(self):
        self.build_nx_graph()

        print("get coordinates from dot")
        self.run_from_svg()
        # self.add_arcs_edges()
        # self.add_arcs_between_time()

    def build_nx_graph(self):
        self.graph = nx.drawing.nx_pydot.from_pydot(self.dot_layout.pydot_graph)
        # self.graph = nx.Graph()
        # self.graph = nx.DiGraph() # Digraph needed to keep direction of links

    # Pydot to networkx function retrieve all attributes from edges but not nodes.
    def run_from_svg(self):
        # json_data = self.dot_layout.pydot_graph.create(format="json")
        # json_data = json.loads(json_data)
        print("Create svg")

        # Not working without these
        self.dot_layout.pydot_graph.prog = 'dot'
        self.dot_layout.pydot_graph.shape_files = list()
        self.dot_layout.pydot_graph.formats = [
            'canon', 'cmap', 'cmapx',
            'cmapx_np', 'dia', 'dot',
            'fig', 'gd', 'gd2', 'gif',
            'hpgl', 'imap', 'imap_np', 'ismap',
            'jpe', 'jpeg', 'jpg', 'mif',
            'mp', 'pcl', 'pdf', 'pic', 'plain',
            'plain-ext', 'png', 'ps', 'ps2',
            'svg', 'svgz', 'vml', 'vmlz',
            'vrml', 'vtx', 'wbmp', 'xdot', 'xlib']

        svg = self.dot_layout.pydot_graph.create(format="svg")

        print("Parse Svg")
        start = timer()
        # soup = BeautifulSoup(svg, 'html.parser')
        soup = BeautifulSoup(svg, 'lxml')
        end = timer()
        print(end - start)

        graph = soup.find("g", {"class": "graph"})
        self.parse_graph_svg(graph)

        nodes = soup.find_all("g", {"class": "node"})
        for node in nodes:
            self.parse_node_svg(node)
        print("Parsing finished")

        # edges = soup.find_all("g", {"class": "edge"})
        # for edge in edges:
        #     self.parse_edge_svg(edge)

    def parse_graph_svg(self, graph):
        transform = graph.get("transform")
        translate = transform.split(" ")
        self.translate_x = int(translate[-2][10:])
        self.translate_y = int(translate[-1][:-1])
        # print("TT ", self.translate_x, self.translate_y)

    def parse_node_svg(self, node):
        node_id = node.find("title").text

        coords = node.find("ellipse")
        x = coords.get("cx")
        y = coords.get("cy")

        x_final = float(x) + self.translate_x
        y_final = float(y) + self.translate_y

        self.graph.nodes[node_id]["x"] = x_final
        self.graph.nodes[node_id]["y"] = y_final

        # self.graph.add_node(node_id, x=x_final, y=y_final)

        # self.nodes[node_id] = [x, y]

        # Add entity type as attribute
        # self.graph.nodes[node_id][ENTITYTYPE_KEY] = "Node"

    def parse_edge_svg(self, edge):
        nodes_txt = edge.find("title").text
        nodes = nodes_txt.split("--")

        source, target = nodes[0], nodes[1]

        self.graph.add_edge(source, target)
        # self.edges.append((source, target, "solid"))  # source, target, solid/invis

    def add_arcs_edges(self):
        for person in self.bip_dyn_graph.persons():
            time_to_documents = self.bip_dyn_graph.person_documents_by_time(person)

            for time, documents in time_to_documents.items():
                person_occurence_nodes = {}
                for document in documents:
                    person_occurence_id = self.dot_layout.generate_person_node_id(person, document, time)
                    person_occurence_nodes[person_occurence_id] = self.graph.nodes[person_occurence_id]["y"]

                sorted_nodes = list(dict(sorted(person_occurence_nodes.items(), key=lambda item: item[1])).keys())
                for i, node in enumerate(sorted_nodes[:-1]):
                    self.graph.add_edge(node, sorted_nodes[i + 1], **{EDGETYPE_KEY: "repetition"})

    def add_arcs_between_time(self):
        for person in self.bip_dyn_graph.persons():
            time_to_documents = self.bip_dyn_graph.person_documents_by_time(person)

            time_and_documents = list(time_to_documents.items())
            for i, (time, documents) in enumerate(time_and_documents[:-1]):
                person_unique_node = self.dot_layout.generate_person_unique_node_id(person, time)
                y_unique = self.graph.nodes[person_unique_node]["y"]

                person_occurences_y = {}
                for document in documents:
                    person_occurence_id = self.dot_layout.generate_person_node_id(person, document, time)
                    person_occurences_y[person_occurence_id] = self.graph.nodes[person_occurence_id]["y"]
                person_occurences_dy = {node: abs(float(y_unique) - float(y)) for node, y in
                                        person_occurences_y.items()}

                person_occurences_t2_y = {}
                time_t2, documents_t2 = time_and_documents[i + 1]
                for document in documents_t2:
                    person_occurence_id = self.dot_layout.generate_person_node_id(person, document, time_t2)
                    person_occurences_t2_y[person_occurence_id] = self.graph.nodes[person_occurence_id]["y"]
                person_occurences_t2_dy = {node: abs(float(y_unique) - float(y)) for node, y in
                                           person_occurences_t2_y.items()}

                closest_node = min(person_occurences_dy, key=person_occurences_dy.get)
                closest_node_t2 = min(person_occurences_t2_dy, key=person_occurences_t2_dy.get)

                self.graph.add_edge(closest_node, closest_node_t2, **{EDGETYPE_KEY: "repetition_crosstime"})

    def run_from_txt(self):
        self.dot_layout.dump_txt()
        with open(self.dot_layout.txt_path) as f:
            for line in f:
                line_parsed = line.split(" ")
                # print(line_parsed)
                type = line_parsed[0]
                if type == "graph":
                    self.parse_graph(line_parsed)
                elif type == "node":
                    self.parse_node(line_parsed)
                elif type == "edge":
                    self.parse_edge(line_parsed)

    def parse_graph(self, line):
        self.scale = line[1]
        self.width = float(line[2])
        self.height = float(line[3])

        self.width_factor = self.CANVAS_DIMS[0] / self.width
        self.height_factor = self.CANVAS_DIMS[1] / self.height

    def parse_node(self, line):
        node_id = line[1]
        x = float(line[2])
        y = float(line[3])
        self.nodes[node_id] = [x, y]

    def parse_edge(self, line):
        self.edges.append((line[1], line[2], line[-2]))  # source, target, solid/invis

    def scale_dimensions(self):
        for node_dims in self.nodes.values():
            node_dims[0] = int(node_dims[0] * self.width_factor)
            node_dims[1] = int(node_dims[1] * self.height_factor)

    def merge_doubled_layers(self):
        # Each node was doubled to find a good layout with dot.
        # This function is to merge those.
        self.merge_doubled_nodes()
        self.merge_doubled_edges()

    def merge_doubled_nodes(self):
        self.nodes_dedoubled = {}
        for node_id, pos in self.nodes.items():
            node_id_parsed, which_layer = self.parse_node_id(node_id)

            if which_layer == "before":
                other_pos = self.nodes[node_id_parsed + "_after"]
            elif which_layer == "after":
                other_pos = self.nodes[node_id_parsed + "_before"]

            pos_updated = self.merge_positions(pos, other_pos)
            self.nodes_dedoubled[node_id_parsed] = pos_updated
        # print(self.nodes_dedoubled)
        self.nodes = self.nodes_dedoubled

    def merge_doubled_edges(self):
        self.edges_dedoubled = set()
        for edge in self.edges:
            self.edges_dedoubled.add((edge[0].rsplit("_", 1)[0], edge[1].rsplit("_", 1)[0]))
        self.edges_dedoubled = [list(edge) for edge in self.edges_dedoubled]
        # print(self.edges_dedoubled)
        self.edges = self.edges_dedoubled

    def merge_positions(self, pos1, pos2):
        pos1 = [float(pos1[0]), float(pos1[1])]
        pos2 = [float(pos2[0]), float(pos2[1])]
        return [(pos1[0] + pos2[0]) / 2, (pos1[1] + pos2[1]) / 2]

    def parse_node_id(self, node_id):
        node_id_parsed = node_id.rsplit("_", 1)
        return node_id_parsed[0], node_id_parsed[1]

    def save_to_file(self, path):
        if not self.json_data: self.to_json()

        with open(path, "w+") as f:
            json.dump(self.json_data, f, indent=4)

    def to_json(self):
        # We need the initial graph to get the node/edges attributes back
        # nodes = self.process_nodes()
        # edges = self.process_edges()

        self.json_data = nx.node_link_data(self.graph)
        self.json_data["metadata"] = {
            "entityType": ENTITYTYPE_KEY,
            "edgeType": EDGETYPE_KEY
        }

        # Metadata are generated from the backend
        # self.json_data = {
        #     "metadata": {
        #         "entityType": ENTITYTYPE_KEY,
        #         "edgeType": EDGETYPE_KEY
        #     },
        #     "nodes": nodes,
        #     "links": edges
        # }

        return self.json_data

    def process_nodes(self):
        nodes = [{
            "id": node_id,
            "x": pos[0],
            "y": pos[1],
        } for node_id, pos in self.nodes.items() if self.keep_node(node_id)]
        return nodes

    def process_edges(self):
        edges = [{
            "source": edge[0],
            "target": edge[1]
        } for edge in self.edges if edge[2] != "invis"]
        return edges

    def keep_node(self, node_id):
        if "after" in node_id or "before" in node_id:
            return False
        else:
            return True

    # Add attributes from original graph
    def process_nodes_add_attributes(self):
        nodes = [{
            **self.bip_dyn_graph.nodes[node_id],
            "id": node_id,
            "x": pos[0],
            "y": pos[1],
        } for node_id, pos in self.nodes.items() if self.keep_node(node_id)]
        return nodes

    def process_edges_add_attributes(self):
        edges = [{
            **nx.Graph(self.bip_dyn_graph).edges[(edge[0], edge[1])],  # TODO : handle Multigraphs
            "source": edge[0],
            "target": edge[1]
        } for edge in self.edges if edge[2] != "invis"]
        return edges

    def compute_sugiyama_coordinates(self, **kwargs):
        print(self.graph.edges.data())
        igraph = ig.Graph.from_networkx(self.graph)
        # layout = igraph.layout_sugiyama(layers="rank", **kwargs)
        layout = igraph.layout_sugiyama(layers="rank", weights="weight", **kwargs)

        # layout.fit_into(BoundingBox(0, 0, 5000, 1000)) # x, y, width, height

        for pos, node_id in zip(layout, self.graph.nodes):
            self.graph.nodes[node_id]["x"] = pos[1]
            self.graph.nodes[node_id]["y"] = pos[0]


