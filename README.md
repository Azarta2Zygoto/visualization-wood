# Modélisation des fluxs de bois

Les données ont été prises parmi celles qui sont mis publiques par [Agreste](https://agreste.agriculture.gouv.fr/agreste-web/disaron/COMEXTBOIS/detail/).

Ce projet consiste en la visualisation interactive de ces données.

## Auteurs

- Clément Petitjean
- Quentin Potiron

## Installation

Pour l'installation de l'application, merci de vous référer au fichier [README.md](./visualization/README.md) que vous trouverez dans le dossier `visualization`.

https://www.d3indepth.com/geographic/

## Données d'entrée

Les données principaux d'entrée sont de 6 types :

- L'année : elle est la même dans toutes les données d'un fichier, le nom du fichier donne l'année des données.
- Le pays (colonne 0).
- Le type de flux (colonne 1) : il y a les exportations, les importations et le type de données, à savoir en volume (en tonnes) ou en argent (en millier d'euros).
- Le mois (colonne 2).
- Le produit (colonne 3).
- La valeur (colonne 4).

En plus de ces données, il y a les données d'agrégation (entre produits et pays) et des données historiques.
