import cytoscape, {
    type CoseLayoutOptions,
} from "https://esm.sh/cytoscape@3.32.0";
import coseBilkent from "https://esm.sh/cytoscape-cose-bilkent@4.1.0";
import fcose from "https://esm.sh/cytoscape-fcose@2.2.0";

cytoscape.use(coseBilkent);
cytoscape.use(fcose as unknown as (cy: typeof cytoscape) => void);

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
        randomize: true,
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
let selectedEdge: cytoscape.EdgeSingular | null = null;
cy.on("tap", "edge", (evt) => {
    selectedEdge = evt.target;
});
document.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", (e) => {
        const action = (e.target as HTMLElement).dataset.action;
        if (action === "add-node") {
            addNode();
        } else if (action === "remove") {
            removeSelected();
        }
    });
});
