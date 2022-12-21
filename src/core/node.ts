import type { Buffer } from "./buffer";

export class ModuleNode {
  magic: Uint8Array;
  version: Uint8Array;
  sections: SectionNode[] = [];

  constructor(buffer: Buffer) {
    this.magic = buffer.readBytes(4);
    this.version = buffer.readBytes(4);

    while (true) {
      if (buffer.eof) break;

      this.sections.push(loadSection(buffer));
    }
  }
}

type SectionNode =
  | TypeSectionNode
  | FunctionSectionNode
  | CodeSectionNode
  | ExportSectionNode;

const TYPE_SECTION_ID = 0x01;
const FUNCTION_SECTION_ID = 0x03;
const EXPORT_SECTION_ID = 0x07;
const CODE_SECTION_ID = 0x0a;

const loadSection = (buffer: Buffer): SectionNode => {
  const sectionId = buffer.readByte();
  const sectionSize = buffer.readU32();
  const sectionBuffer = buffer.readBuffer(sectionSize);

  switch (sectionId) {
    case TYPE_SECTION_ID:
      return new TypeSectionNode(sectionBuffer);
    case FUNCTION_SECTION_ID:
      return new FunctionSectionNode(sectionBuffer);
    case EXPORT_SECTION_ID:
      return new ExportSectionNode(sectionBuffer);
    case CODE_SECTION_ID:
      return new CodeSectionNode(sectionBuffer);
    default:
      throw new Error(`invaild section id: ${sectionId}`);
  }
};

export class TypeSectionNode {
  funcTypes: FuncTypeNode[] = [];

  constructor(buffer: Buffer) {
    this.funcTypes = buffer.readVec(() => new FuncTypeNode(buffer));
  }
}

const FUNC_TYPE_TAG = 0x60;

const I32 = 0x7f;
const I64 = 0x7e;
const F32 = 0x7d;
const F64 = 0x7c;
type NumType = typeof I32 | typeof I64 | typeof F32 | typeof F64;
const FUNC_REF = 0x70;
const EXTERN_REF = 0x6f;
type RefType = typeof FUNC_REF | typeof EXTERN_REF;
type ValType = NumType | RefType;

export class FuncTypeNode {
  paramType: ResultTypeNode;
  resultType: ResultTypeNode;

  constructor(buffer: Buffer) {
    if (buffer.readByte() !== FUNC_TYPE_TAG) {
      throw new Error("invalid functype");
    }
    this.paramType = new ResultTypeNode(buffer);
    this.resultType = new ResultTypeNode(buffer);
  }
}

export class ResultTypeNode {
  valTypes: ValType[] = [];

  constructor(buffer: Buffer) {
    this.valTypes = buffer.readVec(() => buffer.readByte() as ValType);
  }
}

type TypeIdx = number;

export class FunctionSectionNode {
  typeIdxs: TypeIdx[];

  constructor(buffer: Buffer) {
    this.typeIdxs = buffer.readVec(() => buffer.readU32() as TypeIdx);
  }
}

export class CodeSectionNode {
  codes: CodeNode[];

  constructor(buffer: Buffer) {
    this.codes = buffer.readVec(() => new CodeNode(buffer));
  }
}

export class CodeNode {
  size: number;
  func: FuncNode;

  constructor(buffer: Buffer) {
    this.size = buffer.readU32();
    this.func = new FuncNode(buffer.readBuffer(this.size));
  }
}

export class FuncNode {
  localses: LocalsNode[] = [];
  expr: ExprNode;

  constructor(buffer: Buffer) {
    this.localses = buffer.readVec(() => new LocalsNode(buffer));
    this.expr = new ExprNode(buffer);
  }
}

export class ExportSectionNode {
  exports: ExportNode[] = [];

  constructor(buffer: Buffer) {
    this.exports = buffer.readVec(() => new ExportNode(buffer));
  }
}

export class ExportNode {
  name: string;
  exportDesc: ExportDescNode;

  constructor(buffer: Buffer) {
    this.name = buffer.readName();
    this.exportDesc = new ExportDescNode(buffer);
  }
}

export class ExportDescNode {
  tag: number;
  index: number;

  constructor(buffer: Buffer) {
    this.tag = buffer.readByte();
    this.index = buffer.readU32();
  }
}

export class LocalsNode {
  num: number;
  valType: ValType;

  constructor(buffer: Buffer) {
    this.num = buffer.readU32();
    this.valType = buffer.readByte() as ValType;
  }
}

const OP = {
  IF: 0x04,
  ELSE: 0x05,
  END: 0x0b,
  LOCAL_GET: 0x20,
  LOCAL_SET: 0x21,
  I32_CONST: 0x41,
  I32_EQZ: 0x45,
  I32_EQ: 0x46,
  I32_NE: 0x47,
  I32_LT_S: 0x48,
  I32_LT_U: 0x49,
  I32_GT_S: 0x4a,
  I32_GT_U: 0x4b,
  I32_LE_S: 0x4c,
  I32_LE_U: 0x4d,
  I32_GE_S: 0x4e,
  I32_GE_U: 0x4f,
  I32_ADD: 0x6a,
  I32_SUB: 0x6b,
  I32_MUL: 0x6c,
  I32_DIV_S: 0x6d,
  I32_DIV_U: 0x6e,
  I32_REM_S: 0x6f,
  I32_REM_U: 0x70,
} as const;
type OP = typeof OP[keyof typeof OP];

type InstrNode =
  | IfInstrNode
  | I32ConstInstrNode
  | LocalGetInstrNode
  | LocalSetInstrNode
  | I32AddInstrNode
  | I32EqzInstrNode
  | I32LtSInstrNode
  | I32GeSInstrNode
  | I32RemSInstrNode;

export class ExprNode {
  instrs: InstrNode[] = [];
  endOp!: typeof OP.END | typeof OP.ELSE;

  constructor(buffer: Buffer) {
    while (true) {
      const opcode = buffer.readByte() as OP;
      if (opcode === OP.END || opcode === OP.ELSE) {
        this.endOp = opcode;
        break;
      }
      this.instrs.push(createInstrNode(opcode, buffer));
      if (buffer.eof) break;
    }
  }
}

const createInstrNode = (opcode: OP, buffer: Buffer) => {
  switch (opcode) {
    case OP.IF:
      return new IfInstrNode(buffer);
    case OP.I32_CONST:
      return new I32ConstInstrNode(buffer);
    case OP.LOCAL_GET:
      return new LocalGetInstrNode(buffer);
    case OP.LOCAL_SET:
      return new LocalSetInstrNode(buffer);
    case OP.I32_ADD:
      return new I32AddInstrNode();
    case OP.I32_EQZ:
      return new I32EqzInstrNode();
    case OP.I32_LT_S:
      return new I32LtSInstrNode();
    case OP.I32_GE_S:
      return new I32GeSInstrNode();
    case OP.I32_REM_S:
      return new I32RemSInstrNode();
    default:
      throw new Error(`invalid opcode: 0x${opcode.toString(16)}`);
  }
};

export class IfInstrNode {
  blockType: BlockType;
  thenInstrs: ExprNode;
  elseInstrs?: ExprNode;

  constructor(buffer: Buffer) {
    this.blockType = buffer.readByte();
    this.thenInstrs = new ExprNode(buffer);
    if (this.thenInstrs.endOp === OP.ELSE) {
      this.elseInstrs = new ExprNode(buffer);
    }
  }
}
type S33 = number;
type BlockType = typeof OP.IF | ValType | S33;

export class I32ConstInstrNode {
  op = OP.I32_CONST;
  num: number;

  constructor(buffer: Buffer) {
    this.num = buffer.readI32();
  }
}

export class LocalGetInstrNode {
  op = OP.LOCAL_GET;
  localIdx: number;

  constructor(buffer: Buffer) {
    this.localIdx = buffer.readU32();
  }
}

export class LocalSetInstrNode {
  op = OP.LOCAL_SET;
  localIdx: number;

  constructor(buffer: Buffer) {
    this.localIdx = buffer.readU32();
  }
}

export class I32AddInstrNode {
  op = OP.I32_ADD;
}
export class I32EqzInstrNode {
  op = OP.I32_EQZ;
}
export class I32LtSInstrNode {
  op = OP.I32_LT_S;
}
export class I32GeSInstrNode {
  op = OP.I32_GE_S;
}
export class I32RemSInstrNode {
  op = OP.I32_REM_S;
}
