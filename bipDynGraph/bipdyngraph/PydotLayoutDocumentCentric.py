import pydot

import bipdyngraph.BipDynGraph as BipDynGraph
from bipdyngraph.PyDotLayout import PydotLayout


class PydotLayoutDocumentCentri(PydotLayout):
    def __init__(self, bip_dyn_graph: BipDynGraph.BipartiteDynGraph):
        super().__init__(bip_dyn_graph)
        self.graph = bip_dyn_graph

    def build_graph(self):
        self.time_to_subgraph = {}

        self.add_time_nodes()
        self.add_person_lines()
        self.add_document_clusters()

    def add_time_nodes(self):
        for i in range(len(self.graph.times)):
            if i < len(self.graph.times) - 1:
                edge_between_ts = pydot.Edge(f"{self.graph.times[i]}_after", f"{self.graph.times[i + 1]}_before")
                self.pydot_graph.add_edge(edge_between_ts)

            edge_ts = pydot.Edge(f"{self.graph.times[i]}_before", f"{self.graph.times[i]}_after")
            self.pydot_graph.add_edge(edge_ts)

            node_ts_before = pydot.Node(f'{self.graph.times[i]}_before')
            node_ts_after = pydot.Node(f'{self.graph.times[i]}_after')

            subgraph_ts_before = pydot.Subgraph(f"cluster_{i}_before", rank="same")
            subgraph_ts_after = pydot.Subgraph(f"cluster_{i}_after", rank="same")

            subgraph_ts_before.add_node(node_ts_before)
            subgraph_ts_after.add_node(node_ts_after)

            self.time_to_subgraph[self.graph.times[i]] = (subgraph_ts_before, subgraph_ts_after)

    def add_person_lines(self):
        for person in self.graph.persons():
            time_to_documents = self.graph.person_documents_by_time(person)

            for i in range(len(self.graph.times[:-1])):
                time = self.graph.times[i]
                time02 = self.graph.times[i + 1]

                documents = time_to_documents[time]
                documents02 = time_to_documents[time02]

                for document in documents:
                    node_before_name = self.node_id_before(f"{document}_{person}_{time}")
                    node_after_name = self.node_id_after(f"{document}_{person}_{time}")

                    for document_same_layer in documents:
                        node2_after_name = self.node_id_after(f"{document_same_layer}_{person}_{time}")
                        if document != document_same_layer:
                            edge_ts = pydot.Edge(node_before_name, node2_after_name)
                            self.pydot_graph.add_edge(edge_ts)

                    for document2 in documents02:
                        node2_before_name = self.node_id_before(f"{document2}_{person}_{time02}")
                        edge = pydot.Edge(node_after_name, node2_before_name)
                        self.pydot_graph.add_edge(edge)

    def add_document_clusters(self):
        for time in self.graph.times:
            documents = self.graph.documents_at_time(time)
            for document in documents:
                persons = self.graph[document]

                document_subgraph_before = pydot.Subgraph(f"cluster_{document}_before", bgcolor="gray")
                document_subgraph_after = pydot.Subgraph(f"cluster_{document}_after", bgcolor="gray")

                for person in persons:
                    node_before = pydot.Node(self.node_id_before(f"{document}_{person}_{time}"))
                    node_after = pydot.Node(self.node_id_after(f"{document}_{person}_{time}"))
                    document_subgraph_before.add_node(node_before)
                    document_subgraph_after.add_node(node_after)

                self.time_to_subgraph[time][0].add_subgraph(document_subgraph_before)
                self.time_to_subgraph[time][1].add_subgraph(document_subgraph_after)

        for subgraph in self.time_to_subgraph.values():
            self.pydot_graph.add_subgraph(subgraph[0])
            self.pydot_graph.add_subgraph(subgraph[1])

    def dump_dot(self):
        # lines = "lines" if self.person_lines else "nolines"
        # fp = f"layouts/new_dot_layout_{lines}_{len(self.G_static)}_ns{self.nodesep}"
        self.pydot_graph.write(f"test.dot")
        self.pydot_graph.write(f"test.svg", format="svg")

    def node_id_before(self, name):
        return f"{name}_before"

    def node_id_after(self, name):
        return f"{name}_after"
