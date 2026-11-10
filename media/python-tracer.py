import json, sys, traceback

source = sys.stdin.read()
steps, outputs = [], []
def safe(value):
    try:
        json.dumps(value)
        return value
    except TypeError:
        return repr(value)

def tracer(frame, event, arg):
    if frame.f_code.co_filename != '<student-code>':
        return tracer
    if event == 'line':
        variables = {k: safe(v) for k, v in frame.f_locals.items() if not k.startswith('__') and k != 'print'}
        steps.append({'line': frame.f_lineno, 'variables': variables, 'output': list(outputs)})
    return tracer

def captured_print(*args, **kwargs):
    outputs.append(' '.join(str(arg) for arg in args))

try:
    env = {'__name__': '__main__', 'print': captured_print}
    sys.settrace(tracer)
    exec(compile(source, '<student-code>', 'exec'), env, env)
    sys.settrace(None)
    print(json.dumps({'ok': True, 'steps': steps, 'output': outputs}))
except Exception as error:
    sys.settrace(None)
    print(json.dumps({'ok': False, 'steps': steps, 'output': outputs, 'error': ''.join(traceback.format_exception_only(type(error), error)).strip()}))
