import pydot
import jsonpickle

import bipdyngraph.BipDynGraph as BipDynGraph
from bipdyngraph.PyDotLayout import PydotLayout
from bipdyngraph.globals import ENTITYTYPE_KEY, EDGETYPE_KEY

DOCUMENT = "document"
PERSON_TIME = "personTime"


class PydotBipartiteLayout(PydotLayout):
    def __init__(self, bip_dyn_graph: BipDynGraph.BipartiteDynGraph, same_person_edge_weight=10, align=False, json=False):
        super().__init__(bip_dyn_graph)

        self.PERSON_JUMPS = True
        # self.PERSON_JUMPS = False
        self.ALIGN_PERSONS = align

        self.SAME_PERSON_EDGE_WEIGHT = same_person_edge_weight
        self.DOCUMENT_OCCURRENCE_WEIGHT = 1

        self.time_to_ranks = None
        self.time_to_subgraph = None

        if json:
            self.from_json(json)

    def build_graph(self):
        self.time_to_subgraph = {}
        self.time_to_ranks = {}

        self.add_time_nodes()
        print("add person nodes")
        self.add_persons_lines()
        # self.add_full_person_lines()
        # print("add documents")
        self.add_documents()
        print("finished")

    def add_time_nodes(self):
        for i in range(len(self.graph.times)):
            if i < len(self.graph.times) - 1:
                edge_between_ts = pydot.Edge(f"{self.graph.times[i]}_after", f"{self.graph.times[i + 1]}_before", weight=1)
                self.pydot_graph.add_edge(edge_between_ts)

            edge_ts = pydot.Edge(f"{self.graph.times[i]}_before", f"{self.graph.times[i]}_after", weight=1)
            self.pydot_graph.add_edge(edge_ts)

            node_ts_before = pydot.Node(f'{self.graph.times[i]}_before', rank=i * 2)
            node_ts_after = pydot.Node(f'{self.graph.times[i]}_after', rank=i * 2 + 1)

            subgraph_ts_before = pydot.Subgraph(f"{i}_before", rank="same")
            subgraph_ts_after = pydot.Subgraph(f"{i}_after", rank="same")

            # subgraph_ts_before.add_node(node_ts_before)
            # subgraph_ts_after.add_node(node_ts_after)
            self.add_node(node_ts_before, subgraph_ts_before)
            self.add_node(node_ts_after, subgraph_ts_after)

            self.time_to_subgraph[self.graph.times[i]] = (subgraph_ts_before, subgraph_ts_after)
            # self.time_to_anchors[self.graph.times[i]] = (node_ts_before, node_ts_after)
            self.time_to_ranks[self.graph.times[i]] = (i * 2, i * 2 + 1)

    #TODO: add one layer before first time ?
    def add_persons_lines(self):
        for person in self.graph.persons():
            # print(person)
            self.add_person_line(person)

    def add_person_line(self, person, force_align=False):
        times = self.graph.person_times(person)

        if len(times) == 1:
            time = times[0]
            node_id = self.generate_person_unique_node_id(person, time)
            rank = self.time_to_ranks[time][1]
            self.add_person_occurrence_node(node_id, person, rank, time, force_align)

        for i, time in enumerate(times[:-1]):
            rank = self.time_to_ranks[time][1]

            node_id = self.generate_person_unique_node_id(person, time)
            self.add_person_occurrence_node(node_id, person, rank, time, force_align)

            if not self.PERSON_JUMPS:
                if times[i + 1] - times[i] > 1:
                    continue

            node_t2_id = self.generate_person_unique_node_id(person, times[i + 1])

            if i == len(times) - 2:
                rank_t2 = self.time_to_ranks[times[i + 1]][1]
                self.add_person_occurrence_node(node_t2_id, person, rank_t2, times[i + 1], force_align)

            weight = self.SAME_PERSON_EDGE_WEIGHT
            edge = pydot.Edge(node_id, node_t2_id, style="dotted",
                              weight=weight, **{EDGETYPE_KEY: "person_time"})
            self.pydot_graph.add_edge(edge)

    def add_person_occurrence_node(self, id, person, rank, time, force_align=False):
        node = self.pydot_graph.get_node(id)

        if len(node) == 1:
            if force_align:
                node[0].set("group", person)
        elif len(node) == 0:
            if self.ALIGN_PERSONS or force_align:
                person_node_occ = pydot.Node(id, group=person, rank=rank, **{ENTITYTYPE_KEY: PERSON_TIME})
            else:
                person_node_occ = pydot.Node(id, rank=rank, **{ENTITYTYPE_KEY: PERSON_TIME})
            self.add_node(person_node_occ, self.time_to_subgraph[time][1])
        else:
            raise Exception("Several node with same id")


    # Create one person node for each layer, even the ones for documents
    def add_full_person_lines(self):
        for person in self.graph.persons():
            times = self.graph.person_times(person)
            for i, time in enumerate(times):
                subgraph_time = self.time_to_subgraph[time][0]
                subgraph_time_2 = self.time_to_subgraph[time][1]
                rank = self.time_to_ranks[time][0]
                rank_2 = self.time_to_ranks[time][1]

                node_id = self.generate_person_unique_node_id(person, time) + "_documentTime"
                node_id_2 = self.generate_person_unique_node_id(person, time)

                person_node = pydot.Node(node_id, rank=rank, **{ENTITYTYPE_KEY: PERSON_TIME})
                # person_node = pydot.Node(node_id, rank=rank, style="invis", **{ENTITYTYPE_KEY: PERSON_TIME})
                person_node_2 = pydot.Node(node_id_2, rank=rank_2, **{ENTITYTYPE_KEY: PERSON_TIME})
                self.add_node(person_node, subgraph_time)
                self.add_node(person_node_2, subgraph_time_2)

                edge = pydot.Edge(node_id, node_id_2, style="dotted",
                                  weight=self.SAME_PERSON_EDGE_WEIGHT)
                self.pydot_graph.add_edge(edge)

                if not self.PERSON_JUMPS:
                    if times[i + 1] - times[i] > 1:
                        continue

                if i < len(times) - 1:
                    node_t2_id = self.generate_person_unique_node_id(person, times[i + 1]) + "_documentTime"
                    edge = pydot.Edge(node_id_2, node_t2_id, style="dotted",
                                      weight=self.SAME_PERSON_EDGE_WEIGHT)
                    self.pydot_graph.add_edge(edge)

                    # edge to show in the end, without any effect on the layout
                    node_ts2_2 = self.generate_person_unique_node_id(person, times[i + 1])
                    edge_showed = pydot.Edge(node_id_2, node_ts2_2, color="red",
                                             constraint="false", weight=self.SAME_PERSON_EDGE_WEIGHT, **{EDGETYPE_KEY: "person_time"})
                    self.pydot_graph.add_edge(edge_showed)

    # def create_unique_persons(self):
    #     subgraph_persons = pydot.Subgraph(f"persons", rank="same")
    #     anchor_node = pydot.Node("anchor")
    #     subgraph_persons.add_node(anchor_node)
    #
    #     anchor_edge = pydot.Edge("anchor", list(self.time_to_anchors.values())[0][0])
    #     self.pydot_graph.add_edge(anchor_edge)
    #
    #     for person in self.graph.persons():
    #         node = pydot.Node(self.unique_person_node_id(person))
    #         subgraph_persons.add_node(node)
    #     self.pydot_graph.add_subgraph(subgraph_persons)

    def add_documents(self):
        for i, time in enumerate(self.graph.times):
            # if i % 20 == 0:
            #     print(i)
            rank_before, rank_after = self.time_to_subgraph[time]

            documents = self.graph.documents_at_time(time)
            for document in documents:
                document_node_id = self.generate_document_node_id(document, time)
                rank = self.time_to_ranks[time][0]

                # If every node is an ellipse, it's easier to parse after
                document_node = pydot.Node(document_node_id, rank=rank, **{ENTITYTYPE_KEY: DOCUMENT})
                # document_node = pydot.Node(document_node_id, shape="box")
                self.add_node(document_node, rank_before)

                persons = self.graph[document]
                for person in persons:
                    person_node_id = self.generate_person_unique_node_id(person, time)

                    # Already added in other function
                    # person_node = pydot.Node(person_node_id, rank=self.time_to_ranks[time][1], **{ENTITYTYPE_KEY: "person"})
                    # self.add_node(person_node, rank_after)

                    # test add weight person-document for selected person
                    if person == "p320":
                        weight = self.SAME_PERSON_EDGE_WEIGHT * 1000
                        print(weight)
                    else:
                        weight = self.DOCUMENT_OCCURRENCE_WEIGHT

                    # edge = pydot.Edge(person_node_id, document_node_id, **{EDGETYPE_KEY: "document_mention"})
                    edge = pydot.Edge(document_node_id, person_node_id, weight=weight, **{EDGETYPE_KEY: "document_mention"})
                    self.pydot_graph.add_edge(edge)

            self.pydot_graph.add_subgraph(rank_after)
            self.pydot_graph.add_subgraph(rank_before)

    def dump_dot(self, dir_path="../layouts/", dump_svg=True, extra_name=None):
        nojump = "" if self.PERSON_JUMPS else "_nojump"
        align_persons = "_personAlign" if self.ALIGN_PERSONS else ""

        name = f"{dir_path}test_bipartite{nojump}{align_persons}_W{self.SAME_PERSON_EDGE_WEIGHT}"
        if extra_name:
            name = f"{name}_{extra_name}"

        self.pydot_graph.write(f"{name}.dot")

        if dump_svg:
            self.pydot_graph.write(f"{name}.svg", format="svg")

    def dump_txt(self):
        self.txt_path = f"dump.txt"
        self.pydot_graph.write(self.txt_path, format="plain")
        # svg = self.pydot_graph.create_svg()

    def node_id_before(self, name):
        return f"{name}_before"

    def node_id_after(self, name):
        return f"{name}_after"

    # def to_json(self):
    #     return {
    #         "pydot_graph": self.pydot_graph.to_string(),
    #         "time_to_ranks": self.time_to_ranks,
    #         "time_to_subgraph": self.time_to_subgraph
    #     }
    #
    # def from_json(self, json):
    #     self.pydot_graph = pydot.graph_from_dot_data(json["pydot_graph"])
    #     self.time_to_ranks = json["time_to_ranks"]
    #     self.time_to_subgraph = json["time_to_subgraph"]

    def to_json(self):
        return jsonpickle.encode(self, keys=True)



if __name__ == "__main__":
    import json
    import DotLayoutParser
    from BipDynGraph import BipartiteDynGraph

    fp = "../data/Rolla_2modes.json"
    with open(fp) as file:
        json_data = json.load(file)

    graph = BipartiteDynGraph(json_data)

    layout_bipartite = PydotBipartiteLayout(graph, same_person_edge_weight=100)
    layout_bipartite.run()
    layout_bipartite.dump_dot(extra_name="personLineFull")

    dot_parser = DotLayoutParser.DotLayoutParser(layout_bipartite, graph)
    # dot_parser.run_from_txt()
    # dot_parser.run_from_svg()
    dot_parser.run()

    json_graph = dot_parser.to_json()

    path = "layeredGraph.json"
    with open(path, "w+") as f:
        json.dump(json_graph, f)


    # Tests to optimize the .dot file for rapid optimization
    # fp = "../data/Dufournaud_geoloc_1940.json"
    # with open(fp) as file:
    #     json_data = json.load(file)
    #
    # graph = BipartiteDynGraph(json_data)
    #
    # layout_bipartite = PydotBipartiteLayout(graph, same_person_edge_weight=10)
    # layout_bipartite.run()
    # # layout_bipartite.dump_dot("../layouts/Genealogy/", dump_svg=False)
    #
    # dot_parser = DotLayoutParser.DotLayoutParser(layout_bipartite, graph)
    # dot_parser.build_nx_graph()
    # nx_graph = dot_parser.graph
    #
    # print(nx_graph.nodes().data("rank"))

