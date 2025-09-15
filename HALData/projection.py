import json
import networkx as nx

def projection(fp):
    with open(fp) as f:
        graph_json = json.load(f)
    G = nx.node_link_graph(graph_json, False, False)

    person_nodes = [n for n, type in G.nodes("label") if type == "person"]
    documents_nodes = [n for n, type in G.nodes("label") if type == "person"]

    B = nx.bipartite.weighted_projected_graph(G, documents_nodes)
    # print(B.nodes.data())
    # print(B.edges.data())

    for node, attr in G.nodes(data=True):
        if attr["label"] == "document":
            persons = G[node]
            print(node, attr, persons)

            year = int(attr["ts"])

            for node1 in persons:
                for node2 in persons:
                    if node1 != node2:
                        edge = B.edges[node1, node2]
                        edge["time"] = year

    json_data = nx.node_link_data(B)
    with open("inriapubs_projected.json", "w+") as f:
        json.dump(json_data, f)







if __name__ == '__main__':
    projection("inria_3_2012_2014.json")