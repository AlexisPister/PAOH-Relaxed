# README

Paoh-Relaxed is a new dynamic hypergraph visualisation technique and system focused on scalability and a better visualisation of group-level patterns.
The repo has been migrated from https://gitlab.inria.fr/apister/dynbipgraphviz

## Installation

### Backend

The backend run as a python flask server. The dependencies are listed in the backend/environment.yml file. 
One of the dependency is the bipdyngraph package https://gitlab.inria.fr/apister/bipdyngraph.git  
Installing the dependencies can be done in a new conda environment using the command `conda env create -f environment.yml`

Running the backing can be done with the command `python app.py`

### Frontend

The frontend is made in Typescript and runs with the Parcel bundler. 
It depends on several packages along
- dynbipgraph-js (https://gitlab.inria.fr/apister/dynbipgraph-js)
- path-js (https://github.com/AlexisPister/paths) 

After installing the dependencies with `npm i`, the application can be launched in a dev environment using `npm run dev`.




