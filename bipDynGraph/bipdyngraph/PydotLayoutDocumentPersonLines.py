import itertools
import json

import pydot

import bipdyngraph.BipDynGraph as BipDynGraph
from bipdyngraph.globals import ENTITYTYPE_KEY, EDGETYPE_KEY
from bipdyngraph.PyDotLayout import PydotLayout


class PydotLayoutDocumentPersonLines(PydotLayout):
    def __init__(self, bip_dyn_graph: BipDynGraph.BipartiteDynGraph):
        super().__init__(bip_dyn_graph)
        self.graph = bip_dyn_graph

    def build_graph(self):
        self.time_to_subgraph = {}
        self.time_to_anchors = {}
        self.time_to_ranks = {}

        self.add_time_nodes()
        self.create_unique_persons()
        self.add_document_clusters()

    # We add the node to both the sugraph and the graph, to keep the attribute saved
    def add_node(self, node, subgraph):
        subgraph.add_node(node)
        self.pydot_graph.add_node(node)

    def add_time_nodes(self):
        for i in range(len(self.graph.times)):
            if i < len(self.graph.times) - 1:
                edge_between_ts = pydot.Edge(f"{self.graph.times[i]}_after", f"{self.graph.times[i + 1]}_before")
                self.pydot_graph.add_edge(edge_between_ts)

            edge_ts = pydot.Edge(f"{self.graph.times[i]}_before", f"{self.graph.times[i]}_after")
            self.pydot_graph.add_edge(edge_ts)

            node_ts_before = pydot.Node(f'{self.graph.times[i]}_before')
            node_ts_after = pydot.Node(f'{self.graph.times[i]}_after')

            # subgraph_ts_before = pydot.Subgraph(f"cluster_{i}_before", rank="same")
            # subgraph_ts_after = pydot.Subgraph(f"cluster_{i}_after", rank="same")
            subgraph_ts_before = pydot.Subgraph(f"{i}_before", rank="same")
            subgraph_ts_after = pydot.Subgraph(f"{i}_after", rank="same")

            subgraph_ts_before.add_node(node_ts_before)
            subgraph_ts_after.add_node(node_ts_after)

            self.time_to_subgraph[self.graph.times[i]] = (subgraph_ts_before, subgraph_ts_after)
            self.time_to_anchors[self.graph.times[i]] = (node_ts_before, node_ts_after)
            self.time_to_ranks[self.graph.times[i]] = (i, i + 1)

    def create_unique_persons(self):
        subgraph_persons = pydot.Subgraph(f"persons", rank="same")
        anchor_node = pydot.Node("anchor", **{ENTITYTYPE_KEY: "person_unique"})
        # self.add_node(anchor_node, subgraph_persons)
        subgraph_persons.add_node(anchor_node)

        anchor_edge = pydot.Edge("anchor", self.time_to_anchors[self.graph.times[0]][0],
                                 **{EDGETYPE_KEY: "person_time"}, style="dotted")
        self.pydot_graph.add_edge(anchor_edge)

        for person in self.graph.persons():

            # First rank
            node = pydot.Node(self.generate_person_unique_node_id(person), **{ENTITYTYPE_KEY: "person_unique"})
            # self.add_node(node, subgraph_persons)
            subgraph_persons.add_node(node)

            for i, time in enumerate(self.graph.times):
                unique_person_node = pydot.Node(self.generate_person_unique_node_id(person, time),
                                                **{ENTITYTYPE_KEY: "person_unique"}, test=20)
                time_subgraph = self.time_to_subgraph[time][1]
                # self.add_node(unique_person_node, time_subgraph)
                time_subgraph.add_node(unique_person_node)

                if i == 0:
                    edge = pydot.Edge(self.generate_person_unique_node_id(person), self.generate_person_unique_node_id(person, time),
                                      weight=10, **{EDGETYPE_KEY: "person_time"}, style="dotted")
                else:
                    edge = pydot.Edge(self.generate_person_unique_node_id(person, self.graph.times[i - 1]),
                                      self.generate_person_unique_node_id(person, time), weight=100,
                                      **{EDGETYPE_KEY: "person_time"}, style="dotted")
                self.pydot_graph.add_edge(edge)
        self.pydot_graph.add_subgraph(subgraph_persons)  # Must be after the loop

    def add_document_clusters(self):
        for i, time in enumerate(self.graph.times):
            documents = self.graph.documents_at_time(time)
            for document in documents:
                persons = self.graph[document]
                document_subgraph = pydot.Subgraph(f"cluster_{document}", bgcolor="gray")

                for person in persons:
                    person_occurence_id = f"{document}_{person}_{time}"
                    person_occurence_node = pydot.Node(person_occurence_id)
                    document_subgraph.add_node(person_occurence_node)

                    # person_edge = pydot.Edge(perso_occurence_id, self.unique_person_node_id(person, time),
                    #                          **{EDGETYPE_KEY: "person"}, style="invis")
                    person_edge = pydot.Edge(person_occurence_id, self.generate_person_unique_node_id(person, time),
                                             **{EDGETYPE_KEY: "person"})

                    self.pydot_graph.add_edge(person_edge)

                self.link_persons_in_document(persons, document, time)

                self.time_to_subgraph[time][0].add_subgraph(document_subgraph)

        for subgraph in self.time_to_subgraph.values():
            self.pydot_graph.add_subgraph(subgraph[0])
            self.pydot_graph.add_subgraph(subgraph[1])

    def link_persons_in_document(self, persons, document, time):
        person_occurence_ids = [f"{document}_{person}_{time}" for person in persons]
        pairs = itertools.combinations(person_occurence_ids, 2)
        for pair in pairs:
            # print(pair)
            edge = pydot.Edge(pair[0], pair[1], weight=10000000, style="invis", dir="none")
            self.pydot_graph.add_edge(edge)
            edge2 = pydot.Edge(pair[1], pair[0], weight=10000000, style="invis", dir="none")
            self.pydot_graph.add_edge(edge2)

    def dump_dot(self):
        self.pydot_graph.write(f"documentCentricPersons.dot")
        self.pydot_graph.write(f"documentCentricPersons.svg", format="svg")

    def generate_person_unique_node_id(self, person, time=None):
        if time:
            return f"{person}_{time}_unique"
        else:
            return f"{person}_unique"


if __name__ == "__main__":
    import DotLayoutParser
    import BipDynGraph

    fp = "../data/Rolla_2modes.json"
    with open(fp) as file:
        json_data = json.load(file)

    graph = BipDynGraph.BipartiteDynGraph(json_data)

    layout = PydotLayoutDocumentPersonLines(graph)
    layout.run()
    layout.dump_dot()

    dot_parser = DotLayoutParser.DotLayoutParser(layout, graph)
    dot_parser.run()
