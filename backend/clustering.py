from cdlib import algorithms
import networkx as nx


# Function does not have default parameters
def cpm(graph):
    resolution_parameter = 0.5
    coms = algorithms.CPM_Bipartite(graph, resolution_parameter_01=resolution_parameter)
    return coms


# Function does not have default parameters
def spectral(graph):
    k = 3
    coms = algorithms.spectral(graph, kmax=k)
    return coms


ALGORITHMS = {
    "bimlpa": algorithms.bimlpa,
    "condor": algorithms.condor,
    "CPM": cpm,
    "infomap": algorithms.infomap_bipartite,
    "spectral": spectral
}


def process_graph(graph):
    set_bipartite_attribute(graph)
    largest_component = get_largest_component(graph)
    return largest_component


def get_largest_component(graph):
    largest_component = max(nx.connected_components(graph), key=len)
    largest_component_graph = nx.Graph(graph.subgraph(largest_component))
    return largest_component_graph


def set_bipartite_attribute(graph):
    for node, attrs in graph.nodes(data=True):
        if attrs[graph.node_type_key] == graph.hyperedge_type:
            graph.nodes[node]["bipartite"] = 0
        else:
            graph.nodes[node]["bipartite"] = 1


def bipartite_clustering(graph, algorithm_name):
    communities = ALGORITHMS[algorithm_name](graph)
    communities_final = process_community(communities)
    return communities_final



def process_community(coms):
    # node_to_communities = coms.to_node_community_map()

    # We keep only the communities of documents
    node_to_communities = {}
    documents_communities = coms.left_communities
    for community_id, community in enumerate(documents_communities):
        community_id = str(int(community_id) + 1)
        for node in community:
            node_to_communities[node] = [community_id]

    print(node_to_communities)
    # print(coms.to_node_community_map())
    return node_to_communities
