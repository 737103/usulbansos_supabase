const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('bansos.db');

console.log('=== DATA BANTUAN SOSIAL ===');
db.all('SELECT * FROM bantuan_sosial', (err, rows) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('Total records:', rows.length);
        rows.forEach((row, i) => {
            console.log(`${i+1}. ID: ${row.id}, Jenis: ${row.jenis_bantuan}, Status: ${row.status}`);
        });
    }
    
    console.log('\n=== STATISTIK PER JENIS BANTUAN ===');
    db.all('SELECT jenis_bantuan, COUNT(*) as count FROM bantuan_sosial GROUP BY jenis_bantuan', (err, rows) => {
        if (err) {
            console.error('Error:', err);
        } else {
            rows.forEach(row => {
                console.log(`${row.jenis_bantuan}: ${row.count}`);
            });
        }
        
        console.log('\n=== STATISTIK PER STATUS ===');
        db.all('SELECT status, COUNT(*) as count FROM bantuan_sosial GROUP BY status', (err, rows) => {
            if (err) {
                console.error('Error:', err);
            } else {
                rows.forEach(row => {
                    console.log(`${row.status}: ${row.count}`);
                });
            }
            
            console.log('\n=== STATISTIK PER JENIS DAN STATUS ===');
            db.all('SELECT jenis_bantuan, status, COUNT(*) as count FROM bantuan_sosial GROUP BY jenis_bantuan, status', (err, rows) => {
                if (err) {
                    console.error('Error:', err);
                } else {
                    rows.forEach(row => {
                        console.log(`${row.jenis_bantuan} - ${row.status}: ${row.count}`);
                    });
                }
                db.close();
            });
        });
    });
});
