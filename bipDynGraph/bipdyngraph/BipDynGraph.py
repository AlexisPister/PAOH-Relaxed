import networkx as nx
import json
from collections import defaultdict


class BipartiteDynGraph(nx.MultiGraph):
    def __init__(self, json_data=None):
        super().__init__()

        self.time_min = None
        self.time_max = None
        self.times = None

        if json_data:
            if "format" in json_data["metadata"]:
                self.metadata = None
                self.from_paoh_json(json_data)
            else:
                self.from_json(json_data)
        else:
            self.document_type = "DOCUMENT"
            self.person_type = "PERSON"
            self.link_type_key = "role"
            self.node_type_key = "nodeType"
            self.time_key = "time_key"

    def add_person(self, id):
        pass

    def add_document(self, id):
        pass

    def persons(self, with_attributes=False):
        if with_attributes:
            return [(n, attrs) for n, attrs in self.nodes.data() if attrs[self.node_type_key] == self.person_type]
        else:
            return [n for n, attrs in self.nodes.data() if attrs[self.node_type_key] == self.person_type]

    def person_times(self, person):
        # print(type(person))
        documents = self[person]
        documents_with_time = [document for document in documents if self.document_time(document)]
        times = [self.document_time(document) for document in documents_with_time]
        ordered_times_norepetition = sorted(set(times))
        return ordered_times_norepetition

    def persons_at_time(self, time):
        persons = []
        for person in self.persons():
            documents = self[person]
            documents_times = [self.document_time(document) for document in documents]
            if time in documents_times:
                persons.append(person)

        return persons

    def documents(self, data=False, with_time=True):
        documents = [(n, attrs) for n, attrs in self.nodes.data() if attrs[self.node_type_key] == self.document_type]
        if with_time:
            documents = [(n, attrs) for n, attrs in documents if attrs[self.time_key]]
        if not data:
            documents = [n for n, attrs in documents]
        return documents

    def documents_at_time(self, time, with_attributes=False):
        if with_attributes:
            return [(n, attrs) for n, attrs in self.nodes.data() if
                    attrs[self.node_type_key] == self.document_type and attrs[self.time_key] == time]
        else:
            return [n for n, attrs in self.nodes.data() if
                    attrs[self.node_type_key] == self.document_type and attrs[self.time_key] == time]

    def document_time(self, document_id):
        return self.nodes[document_id][self.time_key]

    def person_documents_by_time(self, person):
        time_to_documents = defaultdict(list)
        documents = self[person]
        documents_with_time = [document for document in documents if self.document_time(document)]

        for document in sorted(documents_with_time, key=lambda x: self.document_time(x)):
            time = self.document_time(document)
            time_to_documents[time].append(document)

        return time_to_documents

    def compute_time_spans(self):
        all_times = set()
        for document, attrs in self.documents(True):
            time = attrs[self.time_key]
            # time = self.parse_time(time)
            if time:
                all_times.add(time)
        self.time_min = min(all_times)
        self.time_max = max(all_times)
        self.times = sorted(list(all_times), )

    # TODO: parse semester for aviz dataset, make a datastructure for handling time formats
    def parse_time(self, time):
        if "-" in time:
            time = time.split("-")[0]
        return time


    def retrieve_link_attributes(self, link):
        attributes = {att: value for att, value in link.items() if att not in ["source", "target", self.link_type_key]}
        return attributes

    def remove_times(self, n_keep):
        for time in self.times[n_keep:]:
            documents = self.documents_at_time(time)
            # for document in documents:
            #     self.remove_nodes_from(list(self[document]))
            self.remove_nodes_from(documents)
        self.times = self.times[n_keep:]

    # def remove_documents_without_time(self):
    #     documents_no_time = [doc for doc in self.documents(data=True) if doc[self.time_key]]
    #     self.remove_nodes_from(documents_no_time)


    def from_json(self, json_data):
        self.metadata = json_data["metadata"]
        nodes = json_data["nodes"]
        links = json_data["links"]

        self.document_type = self.metadata["source_entity_type"]
        self.person_type = self.metadata["target_entity_type"]
        self.link_type_key = self.metadata["edgeType"]
        self.node_type_key = self.metadata["entityType"]
        self.time_key = self.metadata["time_key"]

        for node in nodes:
            self.add_node(node["id"], **{attr: value for attr, value in node.items() if attr != "id"})

        for link in links:
            u, v = link["source"], link["target"]
            role = link[self.link_type_key]
            self.add_edge(u, v, key=role)
            attributes = self.retrieve_link_attributes(link)
            nx.set_edge_attributes(self, {(u, v, role): attributes})
        self.compute_time_spans()

    def from_paoh_json(self, json_data):
        metadata = json_data["metadata"]
        nodes = json_data["nodes"]
        links = json_data["links"]

        self.document_type = metadata["source_entity_type"]
        self.person_type = metadata["target_entity_type"]
        self.node_type_key = metadata["entity_type"]
        # self.time_key = metadata["time_slot"]

        # Time slots is always a "ts" key in PAOHVIS
        self.time_key = "ts"

        self.link_type_key = None

        for node in nodes:
            self.add_node(node["id"], **{attr: value for attr, value in node.items() if attr != "id"})

        for link in links:
            u, v = link["source"], link["target"]
            # role = link[self.link_type_key]
            self.add_edge(u, v)
            attributes = self.retrieve_link_attributes(link)
            nx.set_edge_attributes(self, {(u, v, 0): attributes})
        self.compute_time_spans()



if __name__ == "__main__":
    import PyDotBipartiteLayout
    from PydotBipartiteLayoutThreeLayers import PydotBipartiteLayoutThreeLayers
    import DotLayoutParser

    fp = "../data/Rolla_2modes.json"
    with open(fp) as file:
        json_data = json.load(file)

    graph = BipartiteDynGraph(json_data)
    # graph.remove_times(3)
    # print(graph.documents(True))
    # print(graph.times)
    # print(graph.documents_at_time(1717, True))
    # print(graph.documents(True))
    # print(graph.documents(True))
    # graph = nx.node_link_graph(json_data, directed=True)

    # layout = PydotLayout.PydotLayout(graph)
    # layout.run()
    # layout.dump_dot()

    # layout_bipartite = PyDotBipartiteLayout.PydotBipartiteLayout(graph)
    # layout_bipartite.run()
    # layout_bipartite.dump_dot()

    layout_bipartite_duplicates = PydotBipartiteLayoutThreeLayers(graph)
    layout_bipartite_duplicates.run()
    layout_bipartite_duplicates.dump_dot()

    dot_parser = DotLayoutParser.DotLayoutParser(layout_bipartite_duplicates, graph)
    # dot_parser.run_from_txt()
    # dot_parser.run_from_svg()
    dot_parser.run()

    json_graph = dot_parser.to_json()
    print(json_graph)

    path = "layeredGraph.json"
    with open(path, "w+") as f:
        json.dump(json_graph, f)
