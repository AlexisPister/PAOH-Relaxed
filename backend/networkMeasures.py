import networkx as nx


class GraphMeasureComputer:
    def __int__(self):
        self.G = None
    def run(self, G):
        self.G = G
        self.compute_degree()
        self.compute_centrality()

    def compute_degree(self):
        degrees = nx.degree(self.G)
        self.degrees = {v[0]: v[1] for v in degrees}
        # nx.set_node_attributes(self.G, degrees, "_degree")

    def compute_centrality(self):
        self.bb = nx.betweenness_centrality(self.G)
        # nx.set_node_attributes(self.G, bb, "_betweenness")

    def update_json(self, nodes_json):
        for node in nodes_json:
            n_id = node["id"]
            bc = self.bb[n_id]
            degree = self.degrees[n_id]
            node["_betweenness"] = round(bc, 3)
            # node["_betweenness"] = bc
            node["_degree"] = degree
