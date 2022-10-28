// Copyright 2022 Colorful Notion, Inc.
// This file is part of Polkaholic.

// Polkaholic is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Polkaholic is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Polkaholic.  If not, see <http://www.gnu.org/licenses/>.
const express = require('express')
const app = express()
const port = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public', {
    maxAge: '5s'
}))

app.get('/', async (req, res) => {
    try {
        res.render('xcmclient', {}
        );
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

const hostname = "::";

app.listen(port, hostname, () => {
    let uiHostName = `polkaholic.io`
    console.log(`Polkaholic listening on ${uiHostName}:${port}`);
})

