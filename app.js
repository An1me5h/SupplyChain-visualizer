    loadInitialState();
    state.nodes = normalizeNodes(state.nodes);
    state.links = normalizeLinks(state.links);
    render();
    updateDataStatusChip();
    autoLoadDataFile();
