import pydot

import bipdyngraph.BipDynGraph as BipDynGraph
from bipdyngraph.globals import ENTITYTYPE_KEY, EDGETYPE_KEY, TIME_KEY

class PydotLayout:
    def __init__(self, bip_dyn_graph):
        self.graph = bip_dyn_graph
        self.pydot_graph: pydot.Dot = None

        # Has a min value
        self.nodesep = 0.001  # default
        # self.nodesep = 100  # default


        self.options = {
            "graph_type": "digraph",
            # "graph_type": "graph",
            "rankdir": "LR",
            # "splines": "false",
            # "newrank": "true"
            "nodesep": self.nodesep,
            "splines": False,
            # "nslimit": 0
        }

        self.PERSON_JUMPS = False
        self.ALIGN_PERSONS = False

    # We add the node to both the subgraph and the graph, to keep the attribute saved
    def add_node(self, node, subgraph):
        subgraph.add_node(node)
        self.pydot_graph.add_node(node)

    def run(self):
        self.pydot_graph = pydot.Dot(**self.options)
        self.node_to_attributes = {} # pydot graph to networkx do not save node attributes when they are in subgraphs
        self.build_graph()

    def generate_person_unique_node_id(self, person, time=None):
        if time:
            return f"{person}_{time}_unique"
        else:
            return f"{person}_unique"

    def generate_document_node_id(self, document, time):
        return f"{document}"

    def generate_person_node_id(self, person, document, time):
        return f"{person}_{document}_{time}"