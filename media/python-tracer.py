import json
import sys
import traceback

source = sys.stdin.read()
steps, outputs, call_stack, frame_states = [], [], [], {}
MAX_STEPS = 10000

def safe(value, depth=0):
    if depth > 3:
        return repr(value)
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (list, tuple, set)):
        return [safe(item, depth + 1) for item in list(value)[:100]]
    if isinstance(value, dict):
        return {str(key): safe(item, depth + 1) for key, item in list(value.items())[:50]}
    return repr(value)

def snapshot(frame):
    return {name: safe(value) for name, value in frame.f_locals.items()
            if not name.startswith('__') and name != 'print'}

def diff(before, after):
    changes = []
    for name in sorted(set(before) | set(after)):
        old, new = before.get(name), after.get(name)
        if old != new:
            changes.append({'name': name, 'before': old, 'after': new})
    return changes

def emit(frame, event, extra=None):
    if len(steps) >= MAX_STEPS:
        raise RuntimeError('Trace stopped after 10,000 events. Simplify the snippet or reduce its input size.')
    key = id(frame)
    variables = snapshot(frame)
    previous = frame_states.get(key, {})
    item = {
        'event': event,
        'line': frame.f_lineno,
        'function': frame.f_code.co_name,
        'variables': variables,
        'changes': diff(previous, variables),
        'output': list(outputs),
        'stack': list(call_stack)
    }
    if extra:
        item.update(extra)
    steps.append(item)
    frame_states[key] = variables

def tracer(frame, event, arg):
    if frame.f_code.co_filename != '<student-code>':
        return tracer
    function = frame.f_code.co_name
    if event == 'call':
        call_stack.append(function)
        emit(frame, 'call')
    elif event == 'line':
        emit(frame, 'line')
    elif event == 'return':
        emit(frame, 'return', {'return_value': safe(arg)})
        if call_stack:
            call_stack.pop()
        frame_states.pop(id(frame), None)
    elif event == 'exception':
        error_type, error_value, _ = arg
        emit(frame, 'exception', {'exception': error_type.__name__ + ': ' + str(error_value)})
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
    print(json.dumps({
        'ok': False,
        'steps': steps,
        'output': outputs,
        'error': ''.join(traceback.format_exception_only(type(error), error)).strip()
    }))
