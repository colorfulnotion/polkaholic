var initobjects = false;
let tableName = '#tableobjects'
let tableTimelineObjects = null;

function get_object_id(row) {
    let id;
    if (row.type == "extrinsic") {
        id = row.obj.extrinsicID;
    } else if (row.type == "event") {
        id = row.obj.eventID;
        console.log("event", id);
    } else if (row.type == "trace") {
        id = row.obj.traceID;
    }
    if (id != undefined) {
        return id
    }
    return "";
}

function get_object_name(row) {
    if (row.type == "extrinsic") {
        let id = row.obj.extrinsicID;
        if (id != undefined) {
            let ida = id.split("-")
            if (ida.length == 2) {
                return row.chainName + " " + presentExtrinsicIDHash(id, row.obj.extrinsicHash, false);
            }
        }
    } else if (row.type == "event") {
        let id = row.obj.eventID;
        if (id != undefined) {
            let ida = id.split("-")
            if (ida.length == 4) {
                let extrinsicID = `${ida[1]}-${ida[2]}`
                let extrinsicHash = row.obj.extrinsicHash != undefined ? row.obj.extrinsicHash : "unk"
                return row.chainName + " " + presentExtrinsicIDHash(extrinsicID, extrinsicHash, false) + " Event#" + ida[3];
            }
        }
    } else if (row.type == "trace") {
        let id = row.obj.traceID;
        if (id != undefined) {
            let ida = id.split("-");
            if (ida.length == 3) {
                let str = presentBlockNumber(row.id, row.chainName, row.blockNumber);
                return str + " Trace #" + ida[2];
            }
        }

    }
    return "";
}

function presentObject(k, object_name, obj) {
    let objstr = cover_params(obj, "k" + k, 10);

    let str = `    
<div class="accordion  accordion-flush" style="width: 600px">
  <div class="accordion-item">
    <h2 class="accordion-header" id="heading${k}">
      <button class="accordion-button collapsed" type="button" data-mdb-toggle="collapse"
        data-mdb-target="#flush${k}" aria-expanded="true" aria-controls="flush${k}">
        View ${object_name}
      </button>
    </h2>
    <div id="flush${k}" class="accordion-collapse collapse" aria-labelledby="heading${k}">
      <div class="accordion-body">${objstr}</div>
    </div>
  </div>
</div>`
    return str;
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
            }, {
                "targets": [4],
                "visible": true
            }],

            columns: [{
                data: 'type',
                render: function(data, type, row, meta) {
                    return data;
                }
            }, {
                data: 'id',
                render: function(data, type, row, meta) {

                    let str = "";
                    if (row.id != undefined && row.chainName != undefined && row.blockNumber != undefined) {
                        let id = get_object_name(row);
                        return id;
                    } else {
                        console.log(row);
                    }
                    return (str);
                }
            }, {
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
            }, {
                data: 'obj',
                render: function(data, type, row, meta) {
                    if (row.obj != undefined) {
                        let obj = row.obj;
                        let out = "";
                        if (type == "display") {
                            try {
                                let id = get_object_id(row);
                                let title = row.type
                                out = presentObject(id, title, obj)
                            } catch {
                                out += obj;
                            }
                            return out;
                        } else {
                            return JSON.stringify(obj);
                        }
                    } else {
                        return "";
                    }
                }
            }, {
                data: 'ts',
                render: function(data, type, row, meta) {
                    if (row.ts != undefined) {
                        if (type == "display") {
                            return shorttimeConverter(Math.round(row.ts));
                        } else {
                            return row.ts;
                        }
                    }
                    return 0;
                }
            }]
        });
    }
    var table = $(tableName).DataTable();
    table.clear();
    if (objects != undefined) {
        table.rows.add(objects);
    }
    table.draw();
}