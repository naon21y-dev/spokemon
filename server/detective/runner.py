"""Read-only SQL on generated case tables, never on application databases."""
import json, sqlite3, sys
import os
def limits():
    sys.setrecursionlimit(150)
    if os.name == 'posix':
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (128*1024*1024,128*1024*1024))
        resource.setrlimit(resource.RLIMIT_CPU,(2,2))
        resource.setrlimit(resource.RLIMIT_FSIZE,(0,0))
        resource.setrlimit(resource.RLIMIT_NOFILE,(16,16))
        resource.setrlimit(resource.RLIMIT_CORE,(0,0))
        return 'rlimit'
    if os.name == 'nt':
        import ctypes
        from ctypes import wintypes as w
        class BASIC(ctypes.Structure):
            _fields_=[('process_time',ctypes.c_longlong),('job_time',ctypes.c_longlong),('flags',w.DWORD),('min_work',ctypes.c_size_t),('max_work',ctypes.c_size_t),('active',w.DWORD),('affinity',ctypes.c_size_t),('priority',w.DWORD),('scheduling',w.DWORD)]
        class IO(ctypes.Structure):
            _fields_=[(x,ctypes.c_ulonglong) for x in ['read_ops','write_ops','other_ops','read_bytes','write_bytes','other_bytes']]
        class EXT(ctypes.Structure):
            _fields_=[('basic',BASIC),('io',IO),('process_memory',ctypes.c_size_t),('job_memory',ctypes.c_size_t),('peak_process',ctypes.c_size_t),('peak_job',ctypes.c_size_t)]
        kernel=ctypes.WinDLL('kernel32',use_last_error=True)
        kernel.CreateJobObjectW.restype=w.HANDLE
        kernel.SetInformationJobObject.argtypes=[w.HANDLE,ctypes.c_int,ctypes.c_void_p,w.DWORD]
        kernel.AssignProcessToJobObject.argtypes=[w.HANDLE,w.HANDLE]
        kernel.GetCurrentProcess.restype=w.HANDLE
        job=kernel.CreateJobObjectW(None,None);info=EXT();info.basic.flags=0x100|0x2000|0x2;info.basic.process_time=2*10000000;info.process_memory=128*1024*1024
        if not job or not kernel.SetInformationJobObject(job,9,ctypes.byref(info),ctypes.sizeof(info)) or not kernel.AssignProcessToJobObject(job,kernel.GetCurrentProcess()):
            raise RuntimeError('memory limit unavailable')
        return 'job-object'
    raise RuntimeError('unsupported isolation platform')



def execute(job):
    fixture=job['fixture'];con=sqlite3.connect(':memory:',cached_statements=0)
    con.execute('CREATE TABLE suspects(id INTEGER,name TEXT,zone TEXT,color TEXT,speed INTEGER,access INTEGER)')
    con.execute('CREATE TABLE sightings(suspect_id INTEGER,place TEXT,hour INTEGER)')
    con.execute('CREATE TABLE evidence(suspect_id INTEGER,item TEXT,mark TEXT)')
    for table,columns in [('suspects',['id','name','zone','color','speed','access']),('sightings',['suspect_id','place','hour']),('evidence',['suspect_id','item','mark'])]:
        con.executemany('INSERT INTO '+table+' VALUES('+','.join('?' for _ in columns)+')',[[r[k] for k in columns] for r in fixture[table]])
    con.commit();con.execute('PRAGMA query_only=ON');con.execute('PRAGMA temp_store=MEMORY')
    allowed={'suspects','sightings','evidence'};read=set()
    def authorize(action,a,b,database,trigger):
        if action==sqlite3.SQLITE_SELECT:return sqlite3.SQLITE_OK
        if action==sqlite3.SQLITE_READ and a in allowed:read.add(a);return sqlite3.SQLITE_OK
        if action==sqlite3.SQLITE_FUNCTION and (b or '').lower() in {'count','sum','min','max','avg','lower','upper','length','coalesce'}:return sqlite3.SQLITE_OK
        return sqlite3.SQLITE_DENY
    con.set_authorizer(authorize)
    calls=0
    def progress():
        nonlocal calls
        calls+=1
        return 1 if calls>150 else 0
    con.set_progress_handler(progress,1000)
    def query(sql):
        read.clear()
        if not isinstance(sql,str) or len(sql)>4000 or not sql.strip().lower().startswith('select'):raise ValueError('SELECT 조회문 한 개만 실행할 수 있어요.')
        cursor=con.execute(sql);rows=cursor.fetchmany(101)
        if len(rows)>100:raise ValueError('결과가 너무 많아요. 조건을 좁혀 주세요.')
        if sum(len(str(v)) for row in rows for v in row)>12000:raise ValueError('결과 크기를 줄여 주세요.')
        return [list(r) for r in rows],set(read),[v[0] for v in cursor.description]
    expected,_,_=query(job['reference'])
    rows,tables,columns=query(job['sql'])
    canonical=lambda result: sorted(json.dumps(row,ensure_ascii=False,separators=(',',':')) for row in result)
    correct=canonical(rows)==canonical(expected) and set(job.get('requiredTables',[])).issubset(tables)
    return {'correct':correct,'rows':rows,'columns':columns,'message':'' if correct else '조회 결과나 연결 테이블이 미션과 달라요. 조건과 열의 순서를 확인해 보세요.'}
try:
    limits()
    result=execute(json.load(sys.stdin))
except Exception as e:
    result={'correct':False,'message':'SQL을 실행하지 못했어요: '+str(e)[:180]}
print(json.dumps(result,ensure_ascii=False))
