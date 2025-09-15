import numpy as np
import networkx as nx
import random
import json

# Sample list of animal names
animal_names = [
    "cat", "dog", "elephant", "giraffe", "lion", "tiger", "panda", "koala", "kangaroo",
    "zebra", "hippo", "bear", "wolf", "fox", "rhino", "cheetah", "penguin", "dolphin",
    "whale", "shark", "eagle", "hawk", "falcon", "owl", "sparrow", "hummingbird", "parrot",
    "peacock", "duck", "swan", "goose", "rabbit", "squirrel", "deer", "moose", "gazelle",
    "monkey", "gorilla", "chimpanzee", "orangutan", "lemur", "hyena", "leopard", "panther",
    "crocodile", "alligator", "snake", "turtle", "frog", "lizard", "octopus", "squid", "crab",
    "lobster", "shrimp", "starfish", "jellyfish", "seahorse", "snail", "butterfly", "bee",
    "ant", "beetle", "ladybug", "spider", "scorpion", "tarantula", "hedgehog", "armadillo",
    "platypus", "kookaburra", "emu", "wombat", "tasmanian devil", "kiwi", "ostrich", "rhinoceros beetle",
    "buffalo", "moose", "raccoon", "skunk", "porcupine", "hedgehog", "polar bear", "walrus",
    "seal", "otters", "sloth", "anteater", "aardvark", "reindeer", "antelope", "caribou",
    "yak", "gnu", "hippopotamus", "hyena", "jackal", "elephant seal", "meerkat", "armadillo",
    "black bear", "chinchilla", "fennec fox", "lynx", "jaguar", "quokka", "tarsier", "anteater",
    "capybara", "okapi", "lemur", "leopard", "manatee", "numbat", "pangolin", "red panda",
    "serval", "tapir", "bongo", "bongo", "fossa", "gibbon", "saki monkey", "tit", "toucan",
    "star-nosed mole", "springhare", "armadillo girdled lizard", "numbat", "sugar glider", "wallaroo",
    "red-handed tamarin", "green basilisk", "glass frog", "flying dragon", "pufferfish", "blowfish",
    "lionfish", "scorpionfish", "mandarin fish", "blue tang", "parrotfish", "yellow tang",
    "flounder", "swordfish", "goblin shark", "hammerhead shark", "bull shark", "mako shark",
    "giant manta ray", "stingray", "sea turtle", "leatherback turtle", "box turtle",
    "green sea turtle", "giant panda", "red fox", "sea otter", "jaguar", "siberian tiger",
    "bald eagle", "harpy eagle", "humpback whale", "blue whale", "orca", "bottlenose dolphin",
    "gray wolf", "golden eagle", "african elephant", "indian elephant", "saltwater crocodile",
    "american alligator", "black rhinoceros", "white rhinoceros", "black mamba", "king cobra",
    "reticulated python", "green anaconda", "nile crocodile", "poison dart frog",
    "giant african millipede", "giant centipede", "tarantula", "giant desert hairy scorpion",
    "black widow spider", "african lion", "cheetah", "leopard", "giraffe", "african elephant",
    "grizzly bear", "polar bear", "red kangaroo", "blue whale", "bengal tiger", "siberian tiger",
    "american bison", "american flamingo", "african penguin", "african grey parrot",
    "green tree python", "chimpanzee", "koala", "arctic fox", "snow leopard", "red panda",
    "sloth", "raccoon", "meerkat", "black-footed ferret", "beaver", "giant panda", "honey badger",
    "prairie dog", "sea lion", "walrus", "gray whale", "elephant seal", "macaw", "scarlet macaw",
    "cockatoo", "hummingbird", "woodpecker", "kingfisher", "puffin", "hornbill", "horned owl",
    "barn owl", "peregrine falcon", "osprey", "buzzard", "red-tailed hawk", "harpy eagle",
    "bald eagle", "bearded vulture", "black vulture", "turkey vulture", "pheasant", "quail",
    "partridge", "guinea fowl", "dove", "pigeon", "stork", "crane", "flamingo", "pelican",
    "swan", "goose", "duck", "heron", "ibis", "egret", "spoonbill", "albatross", "seagull",
    "tern", "frigatebird", "penguin", "ostrich", "emu", "kiwi", "cassowary", "rhea", "toad",
    "frog", "salamander", "newt", "caecilian", "crocodile", "alligator", "gavial", "iguana",
    "chameleon", "komodo dragon", "gecko", "monitor lizard", "skink", "cobra", "viper",
    "rattlesnake", "black mamba", "king cobra", "anaconda", "python", "boa constrictor",
    "sea snake", "grass snake", "water snake", "garter snake", "hognose snake", "milk snake"]

def name_generator():
    random_animal = random.sample(animal_names, 1)[0]
    # animal_names.remove(random_animal)
    return random_animal
    # return ''.join(random.choice([chr(i) for i in range(ord('a'),ord('z'))]) for _ in range(6))


class Generator:
    def __init__(self, n_nodes: int = 50, p_edge_intra: float = 0.20, p_edge_inter: float = 0.02, community_array: list[int] or None = None):
        self.n_nodes = n_nodes
        self.p_edge_intra = p_edge_intra
        self.p_edge_inter = p_edge_inter
        self.community_array = community_array
        self.counter = 0

        self.node_type = "node"
        self.hyperedge_type = "hyperedge"

        if not self.community_array:
            # n_com = int(n_nodes / 30)
            n_com = 4
            self.community_array = [random.randint(0, n_com - 1) for i in range(n_nodes)]

    def init_graph(self):
        self.G = nx.Graph()
        # self.node_to_com = {}
        self.all_nodes = []
        for idnode in range(self.n_nodes):
            name = self.new_name()
            community = self.community_array[idnode]
            # self.G.add_node(idnode, type=self.node_type, name=name, community=community)
            # self.G.add_node(str(idnode), type=self.node_type, name=name, community=str(community))
            self.G.add_node("p" + str(idnode), type=self.node_type, name=name, community=community)

    def run(self):
        self.init_graph()
        for node in range(self.n_nodes):

            nodes = list(range(self.n_nodes))
            random.shuffle(nodes)
            # print(nodes)

            hyperedge = [node]

            hyperedge = self.create_hyperedge()
            hyperedge_created = self.run_fixed_proba(node, hyperedge, nodes)
            # hyperedge_created = self.run_fixed_size(node, hyperedge, nodes)

            if hyperedge_created:
                self.G.add_edge(hyperedge, "p" + str(node))
            else:
                self.G.remove_node(hyperedge)

    def run_fixed_proba(self, node, hyperedge, nodes):
        hyperedge_created = False
        for i, node2 in enumerate(nodes):
            if node != node2:
                com1 = self.community_array[node]
                com2 = self.community_array[node2]

                p = self.p_edge_intra if com1 == com2 else self.p_edge_inter
                roll = random.random()
                if roll < p:
                    self.G.add_edge(hyperedge, "p" + str(node2))
                    hyperedge_created = True

        return hyperedge_created

    # def run_fixed_proba(self, node, hyperedge, nodes):
    #     hyperedge_created = False
    #     for i, node2 in enumerate(nodes):
    #         if node != node2:
    #             com1 = self.community_array[node]
    #             com2 = self.community_array[node2]
    #
    #             p = self.p_edge_intra if com1 == com2 else self.p_edge_inter
    #             roll = random.random()
    #             if roll < p:
    #                 self.G.add_edge(hyperedge, "p" + str(node2))
    #                 hyperedge_created = True
    #
    #     return hyperedge_created


    def run_fixed_size(self, node, hyperedge, nodes):
        hyperedge_created = False
        hyperedge_size = 1
        for i, node2 in enumerate(nodes):
            if node != node2:
                com1 = self.community_array[node]
                com2 = self.community_array[node2]

                p = self.p_edge_intra if com1 == com2 else self.p_edge_inter
                roll = random.random()
                if roll < p:
                    self.G.add_edge(hyperedge, "p" + str(node2))
                    hyperedge_size += 1
                    hyperedge_created = True

                if hyperedge_size == 3:
                    break;

        return hyperedge_created



    def create_hyperedge(self):
        hyperedge = "h" + str(self.counter)
        self.counter += 1
        self.G.add_node(hyperedge, type=self.hyperedge_type)

        return hyperedge

    def new_name(self):
        name = name_generator()
        if name in dict(self.G.nodes(data="name")).values():
            name = name + "'"
        return name

    def to_json(self):
        graph_json = nx.node_link_data(self.G)
        graph_json["metadata"] = {
            "datasetName": "test",
            "edgeType": "type",
            "entityType": "type",
            "source_entity_type": self.hyperedge_type,
            "target_entity_type": self.node_type,
        }

        #         For Paohvis
        # graph_json["metadata"] = {
        #     "datasetName": "test",
        #     "edgeType": "label",
        #     "entityType": "label",
        #     "name": "name",
        #     "source_entity_type": "document",
        #     "target_entity_type": "person",
        #     "time_key": "time",
        #     "format": "2.1.0",
        #     "entity_type": "label",
        # }

        return graph_json

    def export(self):
        fp = f"hypergraphs/{self.n_nodes}nodes.json"
        with open(fp, "w+") as path:
            json.dump(self.to_json(), path)

        with open("output.json", "w+") as path:
            json.dump(self.to_json(), path)


gen = Generator()
gen.run()
gen.export()