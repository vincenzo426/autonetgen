#!/usr/bin/env python3
"""
Setup script per installare il Network Traffic Analyzer come pacchetto
"""

from setuptools import setup, find_packages

setup(
    name="network_analyzer",
    version="0.1.0",
    description="Network Traffic Analyzer & Terraform Generator",
    author="Network Team",
    packages=find_packages(),
    install_requires=[
        "scapy",
        "pandas",
        "numpy",
        "graphviz",
        "networkx",
        "matplotlib",
    ],
    entry_points={
        "console_scripts": [
            "network-analyzer=main:main",
        ],
    },
)