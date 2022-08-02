var initobjects = false;
let tableName = '#tableobjects'
let tableTimelineObjects = null;

function get_object_id(row) {
    if (row.type == "extrinsic") {
        let id = row.obj.extrinsicID;
        if (id != undefined) {
            let ida = id.split("-")
            if (ida.length == 3) {
                return "Extrinsic#" + ida[2];
            }
        }
    } else if (row.type == "event") {
        let id = row.obj.eventID;
        if (id != undefined) {
            let ida = id.split("-")
            if (ida.length == 4) {
                return "Extrinsic#" + ida[2] + " Event#" + id[3];
            }
        }
    } else if (row.type == "trace") {
        let id = row.obj.traceID;
        if (id != undefined) {
            let ida = id.split("-");
            if (ida.length == 3) {
                return "Trace #" + ida[2];
            }
        }

    }
    return "";
}

function showobjects(objects) {
    if (!initobjects) {
        initobjects = true;
        tableTimelineObjects = $(tableName).DataTable({
            pageLength: -1,
            lengthMenu: [
                [10, 100, 500, -1],
                [10, 100, 500, "All"]
            ],
            order: [
                [4, "asc"]
            ],
            columnDefs: [{
                    "className": "dt-left",
                    "targets": [1, 2, 3]
                },
                {
                    "targets": [4],
                    "visible": true
                }
            ],

            columns: [{
                    data: 'type',
                    render: function(data, type, row, meta) {
                        return data;
                    }
                },
                {
                    data: 'id',
                    render: function(data, type, row, meta) {

                        let str = "";
                        if (row.id != undefined && row.chainName != undefined && row.blockNumber != undefined) {
                            str = presentBlockNumber(row.id, row.chainName, row.blockNumber)
                        } else {
                            console.log(row);
                        }
                        let id = get_object_id(row)
                        if (id.length > 0) {
                            str += "<BR>" + id;
                        }
                        return (str);
                    }
                },
                {
                    data: 'section',
                    render: function(data, type, row, meta) {
                        if (row.obj != undefined) {
                            let obj = row.obj;
                            let typ = row.type;
                            let sectionMethod = ""
                            let cls = "btn-outline-secondary";
                            if (typ == "extrinsic") {
                                let section = (obj.section != undefined) ? obj.section : "unk";
                                let method = (obj.method != undefined) ? obj.method : "unk";
                                cls = "btn-primary";
                                sectionMethod = `${section}:${method}`;
                            } else if (typ == "event") {
                                let section = (obj.section != undefined) ? obj.section : "unk";
                                cls = "btn-secondary";
                                let method = (obj.method != undefined) ? obj.method : "unk";
                                sectionMethod = `${section}:${method}`;
                            } else if (typ == "trace") {
                                let section = (obj.p != undefined) ? obj.p : "unk";
                                let method = (obj.s != undefined) ? obj.s : "unk";
                                sectionMethod = `${section}:${method}`;
                            }
                            if (type == 'display') {
                                let str = `<button type="button" class="btn ${cls} text-capitalize">${sectionMethod}</button>`;
                                return str;
                            } else {
                                return sectionMethod;
                            }
                        }
                        return "";
                    }
                },
                {
                    data: 'obj',
                    render: function(data, type, row, meta) {
                        if (row.obj != undefined) {
                            let obj = row.obj;
                            let out = "";
                            if (type == "display") {
                                try {
                                    let id = get_object_id(row);
                                    out += "<BR>" + cover_params(obj, "k" + id);
                                } catch {
                                    out += "<BR>" + obj;
                                }
                                return out;
                            } else {
                                return JSON.stringify(row.obj);
                            }
                        } else {
                            return "";
                        }
                    }
                },
                {
                    data: 'ts',
                    render: function(data, type, row, meta) {
                        if (row.ts != undefined) {
                            if (type == "display") {
                                return timeConverter(Math.round(row.ts));
                            } else {
                                return row.ts;
                            }
                        }
                        return 0;
                    }
                }
            ]
        });
    }
    var table = $(tableName).DataTable();
    table.clear();
    if (objects != undefined) {
        table.rows.add(objects);
    }
    table.draw();
}