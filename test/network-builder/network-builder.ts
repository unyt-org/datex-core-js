import cytoscape, {
    type CoseLayoutOptions,
} from "https://esm.sh/cytoscape@3.32.0";
import coseBilkent from "https://esm.sh/cytoscape-cose-bilkent@4.1.0";
import fcose from "https://esm.sh/cytoscape-fcose@2.2.0";

cytoscape.use(coseBilkent);
cytoscape.use(fcose as unknown as (cy: typeof cytoscape) => void);

type NetworkDefinition = {
    nodes: Array<{ id: string; label: string }>;
    edges: Array<{
        id: string;
        source: string;
        target: string;
        priority: number;
    }>;
};

class NetworkManager {
    public static async getAllNetworks() {
        const storedNetworks = await (await fetch("/test/")).json();
        return NetworkManager.resolveChildren(
            storedNetworks,
            "network-builder/networks",
        )?.map((e) => e.replace(/\.json$/, ""));
    }
    public static loadNetwork(name: string) {
        return fetch(`/test/network-builder/networks/${name}.json`)
            .then((response) => response.json())
            .then((data: NetworkDefinition) => {
                const nodes = data.nodes?.map((node) => ({
                    group: "nodes",
                    data: node,
                })) ?? [];
                const edges = data.edges?.map((edge) => ({
                    group: "edges",
                    data: edge,
                })) ?? [];
                return { nodes, edges };
            });
    }
    private static resolveChildren(structure: any, path: string) {
        const parts = path.split("/");
        let current = structure;
        for (const part of parts) {
            const next = current.find((item: any) =>
                typeof item === "object" && item.name === part
            );
            if (!next || !Array.isArray(next.children)) {
                return null;
            }
            current = next.children;
        }
        return current as string[];
    }
}

const loadNetwork = async (name: string) => {
    try {
        const network = await NetworkManager.loadNetwork(name);
        globalThis.location.hash = name;
        cy.elements().remove();
        network.nodes.forEach((node) => {
            cy.add(node as any);
        });
        network.edges.forEach((edge) => {
            cy.add(edge as any);
        });
        layout(true);
    } catch (error) {
        console.error("Error loading network:", error);
        globalThis.location.hash = "";
    }
};

const container = document.getElementById("cy");
const cy = cytoscape({
    container,
    style: [
        {
            selector: "node",
            style: {
                "label": "data(label)",
                "background-color": "#61bffc",
                "text-valign": "center",
                "text-halign": "center",
                "width": 40,
                "height": 40,
            },
        },
        {
            selector: "edge",
            style: {
                "label": "data(priority)",
                "width": 3,
                "line-color": "#ccc",
                "target-arrow-color": "#ccc",
                "target-arrow-shape": "triangle",
                "curve-style": "bezier",
            },
        },
        {
            selector: "edge.info",
            style: {
                "line-color": "#2196F3",
                "target-arrow-color": "#2196F3",
            },
        },
        {
            selector: "edge.warning",
            style: {
                "line-color": "#FFC107",
                "target-arrow-color": "#FFC107",
            },
        },
        {
            selector: "edge.danger",
            style: {
                "line-color": "#F44336",
                "target-arrow-color": "#F44336",
            },
        },
        {
            selector: ":selected",
            style: {
                "background-color": "#FF5722",
                "line-color": "#FF5722",
                "target-arrow-color": "#FF5722",
            },
        },
    ],
    elements: [],
});

function layout(fit = false) {
    const options: CoseLayoutOptions = {
        name: "cose",
        randomize: false,
        fit: fit,
        animate: true,
        animationDuration: 400,
    };
    cy.layout({
        ...options,
        name: "fcose",
        tilingPaddingVertical: 50,
        tilingPaddingHorizontal: 50,
    } as any).run();
}

const addNode = (id?: string, position?: { x: number; y: number }) => {
    if (!id) {
        id = Math.floor(Math.random() * 1000).toString();
    }
    cy.add({
        group: "nodes",
        data: { id, label: `@${id}` },
        position,
    });
    if (!position) {
        layout(true);
    }
};
const remove = (node: cytoscape.SingularElementReturnValue) => {
    const id = node.data("id");
    const edges = node.connectedEdges();
    edges.forEach((edge) => {
        const target = edge.target();
        if (target.id() === id) {
            edge.remove();
        }
    });
    node.remove();
};
const removeSelected = () => {
    const collection = cy.$(":selected");
    if (collection.length > 0) {
        collection.forEach((node) => {
            remove(node);
        });
        layout();
    }
};
document.addEventListener("keydown", (e) => {
    const collection = cy.$(":selected");
    if (
        (e.key === "Delete" || e.key === "Backspace") && collection.length > 0
    ) {
        removeSelected();
        layout();
    }
});

cy.on("tap", function (evt) {
    if (evt.target !== cy) {
        return;
    }
    addNode(undefined, evt.position);
    layout();
});
cy.on("tap", "edge", (evt) => {
    openEdgeInfo(evt.target);
});

const openEdgeInfo = (edge: cytoscape.EdgeSingular) => {
    html("edge-id").textContent = edge.id();
    html<HTMLInputElement>("edge-priority-select").value = edge.data(
        "priority",
    );
    html<HTMLOptionElement>("edge-type-select").value = edge.data("type") ||
        "info";

    console.log("Edge info:", edge.id());
};

const addEdge = (source: string, target: string, priority = 0) => {
    const edgeId = `${source}-${target}`;
    if (!cy.getElementById(edgeId).length) {
        cy.add({
            group: "edges",
            data: { id: edgeId, source, target, priority },
        });
    }
};

document.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", async (e) => {
        const action = (e.target as HTMLElement).dataset.action;
        if (action === "add-node") {
            addNode();
        } else if (action === "remove") {
            removeSelected();
        } else if (action === "add-edge") {
            const selected = cy.nodes(":selected");
            if (selected.length === 2) {
                const source = selected[0].id();
                const target = selected[1].id();
                addEdge(source, target);
                selected.unselect();
                layout();
            }
        } else if (action === "load") {
            const networks = await NetworkManager.getAllNetworks();
            const dialog = html<HTMLDialogElement>("network-dialog");
            dialog.querySelector("select")!.innerHTML = "";
            networks?.forEach((network) => {
                const option = document.createElement("option");
                option.value = network;
                option.textContent = network;
                dialog.querySelector("select")!.appendChild(option);
            });
            dialog.showModal();
        } else if (action === "load-network") {
            const dialog = html<HTMLDialogElement>("network-dialog");
            const selected = dialog.querySelector(
                "select",
            ) as HTMLSelectElement;
            const networkName = selected.value;
            loadNetwork(networkName);
        } else if (action === "save") {
            const networkName = globalThis.location.hash.replace("#", "") ||
                prompt("Enter network name");
            if (networkName) {
                const nodes = cy.nodes().map((node) => node.data());
                const edges = cy.edges().map((edge) => edge.data());
                const networkData = { nodes: nodes, edges: edges };
                const handle = await (globalThis as any).showSaveFilePicker({
                    suggestedName: `${networkName}.json`,
                    types: [{
                        description: "JSON file",
                        accept: { "application/json": [".json"] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(
                    new Blob([JSON.stringify(networkData, null, "\t")], {
                        type: "application/json",
                    }),
                );
                await writable.close();
                console.log("Saving network as:", networkName, networkData);
            }
        } else if (action === "clear") {
            cy.elements().remove();
        }
    });
});

function html<T = HTMLElement>(id: string): T {
    return document.getElementById(id)! as T;
}
if (globalThis.location.hash) {
    const networkName = globalThis.location.hash.replace("#", "");
    await loadNetwork(networkName);
}
