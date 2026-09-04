CLOSE_POLICY_VIOLATION = 1008


class ClientError(Exception):

    def __init__(self, code):
        super().__init__(code)
        self.code = code