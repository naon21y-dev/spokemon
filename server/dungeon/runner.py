"""Restricted beginner-Python judge. No user modules, host objects, files or network APIs."""
import ast, builtins, io, json, os, sys

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

ALLOWED=(ast.Module,ast.Expr,ast.Assign,ast.AugAssign,ast.AnnAssign,ast.FunctionDef,ast.arguments,ast.arg,ast.Return,ast.If,ast.For,ast.While,ast.Break,ast.Continue,ast.Pass,ast.Name,ast.Load,ast.Store,ast.Constant,ast.List,ast.Tuple,ast.Dict,ast.Set,ast.Subscript,ast.Slice,ast.BinOp,ast.UnaryOp,ast.BoolOp,ast.Compare,ast.Call,ast.keyword,ast.Attribute,ast.IfExp,ast.ListComp,ast.comprehension,ast.Add,ast.Sub,ast.Mult,ast.Div,ast.FloorDiv,ast.Mod,ast.Pow,ast.USub,ast.UAdd,ast.Not,ast.And,ast.Or,ast.Eq,ast.NotEq,ast.Lt,ast.LtE,ast.Gt,ast.GtE,ast.In,ast.NotIn)
METHODS={'append','extend','insert','pop','remove','count','index','sort','reverse','upper','lower','strip','split','join','replace','startswith','endswith'}
BANNED={'open','eval','exec','compile','globals','locals','vars','getattr','setattr','delattr','dir','input','help','exit','quit','breakpoint','memoryview','super','object','type'}
def validate(code):
    if not isinstance(code,str) or len(code)>6000: raise ValueError('코드는 6,000자 이하로 작성해 주세요.')
    tree=ast.parse(code);nodes=list(ast.walk(tree))
    if len(nodes)>1000: raise ValueError('코드가 너무 복잡해요. 짧은 함수로 작성해 주세요.')
    for n in nodes:
        if not isinstance(n,ALLOWED):raise ValueError('학습용 실행에서는 import·클래스·파일·외부 접근을 사용할 수 없어요.')
        for name in [getattr(n,'id',''),getattr(n,'arg',''),getattr(n,'name','')]:
            if name.startswith('_') or '__' in name or name in BANNED:raise ValueError('외부 환경 접근 이름은 사용할 수 없어요.')
        if isinstance(n,ast.Attribute) and n.attr not in METHODS:raise ValueError('이 메서드는 학습용 실행에서 지원하지 않아요.')
        if isinstance(n,ast.Call) and not isinstance(n.func,(ast.Name,ast.Attribute)):raise ValueError('함수 이름으로 호출해 주세요.')
        if isinstance(n,ast.FunctionDef) and (n.decorator_list or n.args.vararg or n.args.kwarg):raise ValueError('기본 매개변수를 가진 함수로 작성해 주세요.')
        if isinstance(n,ast.keyword) and (n.arg is None or n.arg.startswith('_') or n.arg=='file'):raise ValueError('해당 호출 인수는 지원하지 않아요.')
        if isinstance(n,ast.BinOp) and isinstance(n.op,ast.Pow) and (not isinstance(n.right,ast.Constant) or not isinstance(n.right.value,int) or not 0<=n.right.value<=10):raise ValueError('거듭제곱 지수는 0~10의 정수로 제한돼요.')
    return compile(tree,'<student-code>','exec')

class Output:
    def __init__(self):self.value=''
    def print(self,*args,sep=' ',end='\n'):
        text=sep.join(str(x) for x in args)+end
        if len(self.value)+len(text)>8000:raise ValueError('출력은 8,000자 이하로 제한돼요.')
        self.value+=text

def judge(job):
    compiled=validate(job.get('code'));cases=job.get('tests',[])
    if not cases or len(cases)>12:raise ValueError('테스트를 확인해 주세요.')
    for case in cases:
        out=Output();safe={x:getattr(builtins,x) for x in ['len','range','sum','min','max','abs','round','int','float','str','bool','list','tuple','dict','set','enumerate','zip','sorted','all','any','isinstance']};safe['print']=out.print
        env={'__builtins__':safe};exec(compiled,env,env)
        entry=job.get('entry');actual=env[entry](*case.get('args',[])) if entry else None
        if 'expected' in case and (actual!=case['expected'] or type(actual) is not type(case['expected'])):return {'correct':False,'message':'테스트를 통과하지 못했어요. 경계값과 반환값을 확인해 보세요.'}
        if 'stdout' in case and out.value.strip()!=str(case['stdout']).strip():return {'correct':False,'message':'출력 결과가 달라요. print와 반복 범위를 확인해 보세요.'}
    return {'correct':True,'message':'모든 테스트를 통과했어요.'}

try:
    raw=sys.stdin.buffer.read(100000)
    if len(raw)>=100000:raise ValueError('요청이 너무 커요.')
    payload=json.loads(raw);mode=limits()
    jobs=payload.get('batch') or [payload]
    if len(jobs)>30:raise ValueError('요청이 너무 많아요.')
    results=[judge(j) for j in jobs]
    print(json.dumps({'results':results,'limits':mode},ensure_ascii=False))
except (SyntaxError,IndentationError) as e:
    print(json.dumps({'results':[{'correct':False,'message':f'{getattr(e,"lineno",1)}행의 문법과 들여쓰기를 확인해 주세요.'}]},ensure_ascii=False))
except (MemoryError,RecursionError):
    print(json.dumps({'results':[{'correct':False,'message':'메모리 또는 재귀 제한을 초과했어요.'}]},ensure_ascii=False))
except BaseException as e:
    message=str(e) if isinstance(e,ValueError) else '실행 오류가 있어요. 변수·인덱스·반환값을 확인해 주세요.'
    print(json.dumps({'results':[{'correct':False,'message':message}]},ensure_ascii=False))
