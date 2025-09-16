import pydot

import bipdyngraph.BipDynGraph as BipDynGraph
from bipdyngraph.globals import ENTITYTYPE_KEY, EDGETYPE_KEY
from bipdyngraph.PyDotLayout import PydotLayout


class PydotBipartiteLayoutThreeLayers(PydotLayout):
    def __init__(self, bip_dyn_graph: BipDynGraph.BipartiteDynGraph):
        super().__init__(bip_dyn_graph)

        self.PERSON_JUMPS = False
        self.ALIGN_PERSONS = False

        self.SAME_PERSON_EDGE_WEIGHT = 10
        self.DOCUMENT_PERSON_WEIGHT = 10000000

    def build_graph(self):
        self.time_to_subgraph = {}
        self.time_to_anchors = {}
        self.time_to_ranks = {}

        self.add_time_nodes_three_layers()
        self.create_unique_persons()

        self.add_documents()

    def add_time_nodes_three_layers(self):
        for i in range(len(self.graph.times)):
            if i < len(self.graph.times) - 1:
                edge_between_ts = pydot.Edge(f"{self.graph.times[i]}_three", f"{self.graph.times[i + 1]}_one",
                                             **{EDGETYPE_KEY: "legend"})
                self.pydot_graph.add_edge(edge_between_ts)

            edge_ts_one = pydot.Edge(f"{self.graph.times[i]}_one", f"{self.graph.times[i]}_two",
                                     **{EDGETYPE_KEY: "legend"})
            edge_ts_two = pydot.Edge(f"{self.graph.times[i]}_two", f"{self.graph.times[i]}_three",
                                     **{EDGETYPE_KEY: "legend"})
            self.pydot_graph.add_edge(edge_ts_one)
            self.pydot_graph.add_edge(edge_ts_two)

            node_ts_one = pydot.Node(f'{self.graph.times[i]}_one', test="oh")
            # node_ts_one = pydot.Node(f'{self.graph.times[i]}_one', **{ENTITYTYPE_KEY: "legend"}, test="oh")
            node_ts_two = pydot.Node(f'{self.graph.times[i]}_two', **{ENTITYTYPE_KEY: "legend"})
            node_ts_three = pydot.Node(f'{self.graph.times[i]}_three', **{ENTITYTYPE_KEY: "legend"})

            subgraph_ts_before = pydot.Subgraph(f"{i}_before", rank="same")
            subgraph_ts_after = pydot.Subgraph(f"{i}_after", rank="same")
            subgraph_ts_persons = pydot.Subgraph(f"{i}_persons", rank="same")

            self.add_node(node_ts_one, subgraph_ts_before)
            self.add_node(node_ts_two, subgraph_ts_after)
            self.add_node(node_ts_three, subgraph_ts_persons)

            self.time_to_subgraph[self.graph.times[i]] = (subgraph_ts_before, subgraph_ts_after, subgraph_ts_persons)
            self.time_to_anchors[self.graph.times[i]] = (node_ts_one, node_ts_two, node_ts_three)
            self.time_to_ranks[self.graph.times[i]] = (i, i + 1, i + 2)

    def create_unique_persons(self):
        subgraph_persons = pydot.Subgraph(f"persons", rank="same")
        anchor_node = pydot.Node("anchor", **{ENTITYTYPE_KEY: "person_unique"})
        # subgraph_persons.add_node(anchor_node)
        self.add_node(anchor_node, subgraph_persons)

        anchor_edge = pydot.Edge("anchor", list(self.time_to_anchors.values())[0][0], **{EDGETYPE_KEY: "person_time"},
                                 weight=self.SAME_PERSON_EDGE_WEIGHT)
        self.pydot_graph.add_edge(anchor_edge)

        for person in self.graph.persons():
            # First rank
            node = pydot.Node(self.generate_person_unique_node_id(person), **{ENTITYTYPE_KEY: "person_unique"})
            # subgraph_persons.add_node(node)
            self.add_node(node, subgraph_persons)

            for i, time in enumerate(self.graph.times):
                unique_person_node = pydot.Node(self.generate_person_unique_node_id(person, time),
                                                **{ENTITYTYPE_KEY: "person_unique"}, test=20)
                time_subgraph = self.time_to_subgraph[time][2]
                # time_subgraph.add_node(unique_person_node)
                self.add_node(unique_person_node, time_subgraph)

                if i == 0:
                    edge = pydot.Edge(self.generate_person_unique_node_id(person), self.generate_person_unique_node_id(person, time),
                                      weight=self.SAME_PERSON_EDGE_WEIGHT, **{EDGETYPE_KEY: "person_time"})
                else:
                    edge = pydot.Edge(self.generate_person_unique_node_id(person, self.graph.times[i - 1]),
                                      self.generate_person_unique_node_id(person, time), weight=self.SAME_PERSON_EDGE_WEIGHT,
                                      **{EDGETYPE_KEY: "person_time"})
                self.pydot_graph.add_edge(edge)

        self.pydot_graph.add_subgraph(subgraph_persons)

    def add_documents(self):
        for i, time in enumerate(self.graph.times):
            # if i == 4:
            #     break

            rank_before, rank_after, rank_persons = self.time_to_subgraph[time]

            documents = self.graph.documents_at_time(time)
            for document in documents:
                document_node_id = self.generate_document_node_id(document, time)

                # If every node is an ellipse, it's easier to parse after
                document_node = pydot.Node(document_node_id, **{ENTITYTYPE_KEY: "document"}, test=20)
                # document_node = pydot.Node(document_node_id, shape="box")
                # rank_before.add_node(document_node)
                self.add_node(document_node, rank_before)

                persons = self.graph[document]
                for person in persons:
                    person_node_id = self.generate_person_node_id(person, document, time)

                    person_node = pydot.Node(person_node_id, **{ENTITYTYPE_KEY: "person_occurence"}, test="red")
                    # rank_after.add_node(person_node)
                    self.add_node(person_node, rank_after)

                    edge = pydot.Edge(document_node_id, person_node_id, **{EDGETYPE_KEY: "document_mention"},
                                      weight=self.DOCUMENT_PERSON_WEIGHT)
                    self.pydot_graph.add_edge(edge)

                    # person_edge = pydot.Edge(self.unique_person_node_id(person), person_node_id, style="invis")
                    # person_edge = pydot.Edge(self.unique_person_node_id(person), person_node_id)
                    person_edge = pydot.Edge(person_node_id, self.generate_person_unique_node_id(person, time),
                                             **{EDGETYPE_KEY: "person"}, style="invis")
                    # person_edge = pydot.Edge(person_node_id, self.unique_person_node_id(person, time), style="invis")
                    self.pydot_graph.add_edge(person_edge)

            self.pydot_graph.add_subgraph(rank_after)
            self.pydot_graph.add_subgraph(rank_before)
            self.pydot_graph.add_subgraph(rank_persons)

    def dump_dot(self, dir_path="../layouts/"):
        nojump = "" if self.PERSON_JUMPS else "_nojump"
        align_persons = "_personAlign" if self.ALIGN_PERSONS else ""

        self.pydot_graph.write(
            f"{dir_path}test_bipartite{nojump}{align_persons}_duplicatePersons_WD{self.DOCUMENT_PERSON_WEIGHT}_WP{self.SAME_PERSON_EDGE_WEIGHT}.dot")
        self.pydot_graph.write(
            f"{dir_path}test_bipartite{nojump}{align_persons}_duplicatePersons_WD{self.DOCUMENT_PERSON_WEIGHT}_WP{self.SAME_PERSON_EDGE_WEIGHT}.svg",
            format="svg")

    def node_id_before(self, name):
        return f"{name}_before"

    def node_id_after(self, name):
        return f"{name}_after"
