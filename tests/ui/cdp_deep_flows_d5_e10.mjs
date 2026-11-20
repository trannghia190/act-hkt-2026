// Kịch bản UI flow D5→E10 (Chrome CDP, headless). Cách chạy:
//   1) ./run-local.sh  2) chrome --headless --remote-debugging-port=9222  3) node tests/ui/cdp_deep_flows_d5_e10.mjs
const base='http://127.0.0.1:9222';
const target=await (await fetch(`${base}/json/new?http://127.0.0.1:3000/login`,{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl); let id=0; const p=new Map(); const bad=[];
ws.onmessage=(ev)=>{const m=JSON.parse(ev.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);} else if(m.method==='Network.responseReceived'){const u=m.params.response.url; if(u.includes('/api/')&&m.params.response.status>=400) bad.push(u.split('/api/v1')[1]+' '+m.params.response.status);}};
await new Promise(r=>ws.onopen=r);
const send=(m,params={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.value;
let fail=0; const chk=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' :: '+String(x).slice(0,180))); if(!c) fail++;};
const stubs=async(confirmVal, prompts=[]) => ev(`(()=>{window.__prompts=${JSON.stringify(prompts)};window.__alerts=[];window.prompt=(m,d)=>{const q=window.__prompts.shift();return q===undefined?d:q};window.confirm=()=>${confirmVal?'true':'false'};window.alert=(m)=>window.__alerts.push(String(m));return 'ok';})()`);
const nav=async(path,ms=2200)=>{await send('Page.navigate',{url:'http://127.0.0.1:3000'+path});await sleep(ms);};
const clickText=async(sel,text)=>ev(`(()=>{const el=[...document.querySelectorAll('${sel}')].find(x=>x.textContent.includes(${JSON.stringify(text)}));if(!el)return false;el.click();return true})()`);
const setVal=async(match,value)=>ev(`(()=>{const els=[...document.querySelectorAll('${match}')];if(!els.length)return false;const el=els[els.length-1];const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:(el.type==='number'?HTMLInputElement.prototype:HTMLInputElement.prototype);const s=Object.getOwnPropertyDescriptor(proto,'value').set;s.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
await nav('/login',1800);
await ev(`(()=>{const u=document.querySelector('input:not([type=password])');const pw=document.querySelector('input[type=password]');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(u,'01HR');u.dispatchEvent(new Event('input',{bubbles:true}));s.call(pw,'123456');pw.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('button[type=submit]').click();return 'ok';})()`);await sleep(1800);

// ===== D5: điều chỉnh tay + validate + xuất Excel =====
await nav('/attendance/leave-ledger?user=137ACT');
await stubs(true);
chk('D5.1 Mở modal điều chỉnh', await clickText('button','Điều Chỉnh Số Dư Phép'));
await sleep(400);
chk('D5.2 Modal hiện form', await ev(`document.body.innerText.includes('Mã nhân viên cần điều chỉnh')`));
await clickText('button','Xác Nhận Ghi Sổ Cái'); await sleep(400);
chk('D5.3 Thiếu lý do → báo lỗi tại chỗ', await ev(`document.body.innerText.includes('Phải nhập căn cứ')||document.body.innerText.includes('Nhập mã nhân viên')`), await ev(`document.querySelector('.fixed.inset-0')?.innerText`));
await setVal('textarea','UI flow D5 điều chỉnh');
await setVal('input[type=number]','0.5');
const alertsBefore=await ev('window.__alerts.length');
await clickText('button','Xác Nhận Ghi Sổ Cái'); await sleep(1400);
chk('D5.4 Lưu thành công → alert xác nhận', (await ev('window.__alerts.length'))>alertsBefore);
await sleep(600);
chk('D5.5 Sổ cập nhật dòng mới', await ev(`document.body.innerText.includes('UI flow D5 điều chỉnh')`));

// ===== E1/E2: sửa ô tại chỗ + ô đỏ + lưu view + khoá confirm =====
await nav('/attendance/timesheet',2600);
await stubs(false,['1.00','UI flow E1 sửa ô']);
const dbl = await ev(`(()=>{const tr=[...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('136ACT'));if(!tr)return false;const td=[...tr.querySelectorAll('td')].find(t=>(t.title||'').startsWith('Ngày 10/'));if(!td)return false;td.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));return true})()`);
chk('E1.1 Nhấp đúp ô ngày mở sửa', dbl===true);
await sleep(1200);
chk('E1.2 Ô sau sửa hiện ký hiệu mới', await ev(`(()=>{const tr=[...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('136ACT'));const td=[...tr.querySelectorAll('td')].find(t=>(t.title||'').startsWith('Ngày 10/'));return td.innerText.trim()==='1.00'})()`));
chk('E1.3 Ô đã sửa tô đỏ', await ev(`(()=>{const tr=[...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('136ACT'));const td=[...tr.querySelectorAll('td')].find(t=>(t.title||'').startsWith('Ngày 10/'));return td.className.includes('rose')})()`));
await stubs(false,['UI flow view']);
await clickText('button','Lưu view'); await sleep(700);
chk('E2.1 Lưu view lưu vào localStorage', await ev(`(localStorage.getItem('pulse_timesheet_views')||'').includes('UI flow view')`));
await stubs(false);
await clickText('button','Khóa Bảng Công Tháng'); await sleep(700);
chk('E1.4 Confirm huỷ → không khoá kỳ', await ev(`!document.body.innerText.includes('Đã Khóa Kỳ Công')`));

// ===== E3/E4: sửa luật có confirm + lịch sử =====
await nav('/admin/rules',2600);
await stubs(true);
chk('E3.1 Mở form sửa luật', await clickText('button','Sửa'));
await sleep(400);
chk('E3.2 Form sửa hiện ngày hiệu lực + lý do', await ev(`document.body.innerText.includes('Lý do')&&document.body.innerText.includes('hiệu lực')||document.body.innerText.includes('Áp dụng từ')`));
await ev(`window.__alerts=[]`); await clickText('button','Lưu phiên bản mới'); await sleep(600);
chk('E3.3 Thiếu lý do → chặn lưu', (await ev('window.__alerts.join("|")')).includes('lý do'));
await setVal('input[placeholder*="VD: HR"]','UI flow E3');
await clickText('button','Lưu phiên bản mới'); await sleep(1600);
chk('E3.4 Confirm OK → lưu tạo phiên bản', await ev(`document.body.innerText.includes('Đã lưu quy định')`));
await stubs(false);
chk('E4.1 Mở lịch sử thay đổi', await clickText('button','Lịch sử thay đổi'));
await sleep(600);
chk('E4.2 Lịch sử có nút Rollback', await ev(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Rollback'))`));

// ===== E5: tìm kiếm tra cứu =====
await nav('/admin/policy-doc',2400);
const before=await ev(`(async()=>{for(let i=0;i<25;i++){const m=document.body.innerText.match(/Mục lục: (\\d+) quy định/);if(m)return Number(m[1]);await new Promise(r=>setTimeout(r,200));}return null})()`);
await ev(`(()=>{const el=document.querySelector('input[placeholder*="ìm"]');if(!el)return false;const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(el,'phép');el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
await sleep(700);
const after=await ev(`(async()=>{for(let i=0;i<25;i++){const m=document.body.innerText.match(/Mục lục: (\\d+) quy định/);const n=m?Number(m[1]):null;if(n!==null&&n<${before})return n;await new Promise(r=>setTimeout(r,200));}const m=document.body.innerText.match(/Mục lục: (\\d+) quy định/);return m?Number(m[1]):null})()`);
chk('E5.1 Tìm kiếm tra cứu lọc đúng', before!==null && after!==null && after<before, before+' -> '+after);

// ===== E6: thêm ca + thêm ngày lễ =====
await nav('/admin/shifts',2400);
await stubs(true);
chk('E6.1 Mở modal thêm ca', await clickText('button','Thêm ca'));
await sleep(400);
chk('E6.2 Modal ca có giờ vào/ra/trưa', await ev(`document.body.innerText.includes('Vào từ')&&document.body.innerText.includes('Nghỉ trưa từ')`));
await ev(`(()=>{const m=document.querySelector('.fixed.inset-0');const inputs=[...m.querySelectorAll('input:not([type=time])')];const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;if(inputs[0]){s.call(inputs[0],'SHIFT_UI');inputs[0].dispatchEvent(new Event('input',{bubbles:true}))}if(inputs[1]){s.call(inputs[1],'Ca UI test');inputs[1].dispatchEvent(new Event('input',{bubbles:true}))}return 'ok'})()`);
await clickText('button','Lưu ca'); await sleep(1400);
chk('E6.3 Thêm ca hiện trong danh sách', await ev(`document.body.innerText.includes('SHIFT_UI')||document.body.innerText.includes('Ca UI test')`));
await ev(`(()=>{const btns=[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('Ngày lễ'));if(btns[0])btns[0].click();return 'ok'})()`);
await sleep(400);

// ===== E7: thêm loại nghỉ + chặn trùng mã =====
await nav('/admin/leave-types',2200);
chk('E7.1 Mở modal thêm loại nghỉ', await clickText('button','Thêm loại nghỉ'));
await sleep(400);
await ev(`(()=>{const m=document.querySelector('.fixed.inset-0');const ins=[...m.querySelectorAll('input')].filter(i=>!i.type||i.type==='text');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(ins[0],'UIQ');ins[0].dispatchEvent(new Event('input',{bubbles:true}));s.call(ins[1],'Loại nghỉ UI test');ins[1].dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()`);
await clickText('button','Lưu'); await sleep(1400);
chk('E7.2 Thêm loại nghỉ thành công', await ev(`document.body.innerText.includes('UIQ')`));
chk('E7.3 Mở lại form để test trùng mã', await clickText('button','Thêm loại nghỉ'));
await sleep(400);
await ev(`(()=>{const m=document.querySelector('.fixed.inset-0');const ins=[...m.querySelectorAll('input')].filter(i=>!i.type||i.type==='text');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(ins[0],'UIQ');ins[0].dispatchEvent(new Event('input',{bubbles:true}));s.call(ins[1],'Trùng');ins[1].dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()`);
await clickText('button','Lưu'); await sleep(1200);
chk('E7.4 Trùng mã hiện lỗi thân thiện', await ev(`document.body.innerText.includes('tồn tại')`));

// ===== E8: duyệt + thu hồi thiết bị =====
await nav('/admin/devices',2200);
chk('E8.1 Thấy thiết bị chờ duyệt', await ev(`document.body.innerText.includes('UI-FLOW-DEV')`));
await stubs(true);
const rowAct = async (label) => ev(`(()=>{const rows=[...document.querySelectorAll('div')].filter(d=>d.innerText.includes('UI-FLOW-DEV')&&[...d.querySelectorAll('button')].some(b=>b.textContent.trim()==='${label}'));const row=rows[rows.length-1];if(!row)return false;const b=[...row.querySelectorAll('button')].find(b=>b.textContent.trim()==='${label}');if(!b)return false;b.click();return true})()`);
chk('E8.2 Duyệt thiết bị đúng dòng', await rowAct('Duyệt'));
await sleep(1500);
await stubs(true,['Mất máy test']);
chk('E8.3 Duyệt xong hiện nút Thu hồi của thiết bị', await rowAct('Thu hồi'));
await sleep(400);
chk('E8.4 Thu hồi → toast xác nhận', await ev(`(document.querySelector('.fixed.top-16')?.innerText||'').includes('Đã thu hồi thiết bị')`));

// ===== E10: lọc + tổng + click =====
await nav('/attendance/leave-table',2200);
const rowsBefore=await ev(`document.querySelectorAll('tbody tr').length`);
const selChanged=await ev(`(()=>{const sel=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.text.includes('Sắp hết')));if(!sel)return false;const s=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;s.call(sel,'NEAR');sel.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
await sleep(500);
const rowsAfter=await ev(`document.querySelectorAll('tbody tr').length`);
chk('E10.1 Lọc sắp hết phép lọc đúng', selChanged===true && rowsAfter<=rowsBefore && rowsAfter>0, rowsBefore+' -> '+rowsAfter);
const unexpected=bad.filter(b=>!b.startsWith('/admin/leave-types 400'));
chk('E10.2 Không API 4xx/5xx (bỏ qua lỗi trùng mã chủ đích)', unexpected.length===0, unexpected.join(' | '));
chk('E10.3 Không màn hình lỗi', !(await ev(`document.body.innerText.includes('Màn hình đang gặp lỗi')`)));
console.log(fail===0?'\nALL DEEP UI FLOW TESTS PASSED':`\n${fail} FAILED`);
ws.close(); process.exitCode=fail?1:0;
