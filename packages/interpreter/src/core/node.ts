import { Buffer } from "./buffer";
import {
  OPCODE,
  SECTION_ID,
  NUM_TYPE,
  REFERENCE_TYPE,
  FUNC_TYPE_TAG,
} from "./constants";

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

  store(buffer: Buffer) {
    buffer.writeBytes(this.magic);
    buffer.writeBytes(this.version);

    for (const section of this.sections) {
      section.store(buffer);
    }
  }
}

const TEMP_BUFFER_LENGTH = 1024;

const createTempBuffer = () =>
  new Buffer({ buffer: new ArrayBuffer(TEMP_BUFFER_LENGTH) });

type SectionNode =
  | TypeSectionNode
  | FunctionSectionNode
  | CodeSectionNode
  | ExportSectionNode;

const loadSection = (buffer: Buffer): SectionNode => {
  const sectionId = buffer.readByte();
  const sectionSize = buffer.readU32();
  const sectionBuffer = buffer.readBuffer(sectionSize);

  switch (sectionId) {
    case SECTION_ID.CUSTOM:
      throw new Error(`unimplemented section id: ${sectionId}`);
    case SECTION_ID.TYPE:
      return new TypeSectionNode(sectionBuffer);
    case SECTION_ID.IMPORT:
      throw new Error(`unimplemented section id: ${sectionId}`);
    case SECTION_ID.FUNCTION:
      return new FunctionSectionNode(sectionBuffer);
    case SECTION_ID.TABLE:
    case SECTION_ID.MEMORY:
    case SECTION_ID.GLOBAL:
    case SECTION_ID.START:
    case SECTION_ID.ELEMENT:
      throw new Error(`unimplemented section id: ${sectionId}`);
    case SECTION_ID.EXPORT:
      return new ExportSectionNode(sectionBuffer);
    case SECTION_ID.CODE:
      return new CodeSectionNode(sectionBuffer);
    case SECTION_ID.DATA:
    case SECTION_ID.DATA_COUNT:
      throw new Error(`unimplemented section id: ${sectionId}`);
    default:
      throw new Error(`invaild section id: ${sectionId}`);
  }
};

export class TypeSectionNode {
  funcTypes: FuncTypeNode[] = [];

  constructor(buffer: Buffer) {
    this.funcTypes = buffer.readVec(() => new FuncTypeNode(buffer));
  }

  store(buffer: Buffer) {
    buffer.writeByte(SECTION_ID.TYPE);
    const sectionsBuffer = createTempBuffer();
    sectionsBuffer.writeVec(this.funcTypes, (funcType) => {
      funcType.store(sectionsBuffer);
    });
    buffer.append(sectionsBuffer);
  }
}

type ValType = NUM_TYPE | REFERENCE_TYPE;

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

  store(buffer: Buffer) {
    buffer.writeByte(FUNC_TYPE_TAG);
    this.paramType.store(buffer);
    this.resultType.store(buffer);
  }
}

export class ResultTypeNode {
  valTypes: ValType[] = [];

  constructor(buffer: Buffer) {
    this.valTypes = buffer.readVec(() => buffer.readByte() as ValType);
  }

  store(buffer: Buffer) {
    buffer.writeVec(this.valTypes, (valType) => {
      buffer.writeByte(valType);
    });
  }
}

type TypeIdx = number;

export class FunctionSectionNode {
  typeIdxs: TypeIdx[];

  constructor(buffer: Buffer) {
    this.typeIdxs = buffer.readVec(() => buffer.readU32() as TypeIdx);
  }

  store(buffer: Buffer) {
    buffer.writeByte(SECTION_ID.FUNCTION);
    const sectionsBuffer = createTempBuffer();
    sectionsBuffer.writeVec(this.typeIdxs, (typeIdx) => {
      sectionsBuffer.writeU32(typeIdx);
    });
    buffer.append(sectionsBuffer);
  }
}

export class CodeSectionNode {
  codes: CodeNode[];

  constructor(buffer: Buffer) {
    this.codes = buffer.readVec(() => new CodeNode(buffer));
  }

  store(buffer: Buffer) {
    buffer.writeByte(SECTION_ID.CODE);
    const sectionsBuffer = createTempBuffer();
    sectionsBuffer.writeVec(this.codes, (code) => {
      code.store(sectionsBuffer);
    });
    buffer.append(sectionsBuffer);
  }
}

export class CodeNode {
  size: number;
  func: FuncNode;

  constructor(buffer: Buffer) {
    this.size = buffer.readU32();
    this.func = new FuncNode(buffer.readBuffer(this.size));
  }

  store(buffer: Buffer) {
    const funcBuffer = createTempBuffer();
    this.func.store(funcBuffer);
    buffer.append(funcBuffer);
  }
}

export class FuncNode {
  locals: LocalsNode[] = [];
  expr: ExprNode;

  constructor(buffer: Buffer) {
    this.locals = buffer.readVec(() => new LocalsNode(buffer));
    this.expr = new ExprNode(buffer);
  }

  store(buffer: Buffer) {
    buffer.writeVec(this.locals, (locals) => {
      locals.store(buffer);
    });
    this.expr.store(buffer);
  }
}

export class ExportSectionNode {
  exports: ExportNode[] = [];

  constructor(buffer: Buffer) {
    this.exports = buffer.readVec(() => new ExportNode(buffer));
  }

  store(buffer: Buffer) {
    buffer.writeByte(SECTION_ID.EXPORT);
    const sectionsBuffer = createTempBuffer();
    sectionsBuffer.writeVec(this.exports, (ex) => {
      ex.store(sectionsBuffer);
    });
    buffer.append(sectionsBuffer);
  }
}

export class ExportNode {
  name: string;
  exportDesc: ExportDescNode;

  constructor(buffer: Buffer) {
    this.name = buffer.readName();
    this.exportDesc = new ExportDescNode(buffer);
  }

  store(buffer: Buffer) {
    buffer.writeName(this.name);
    this.exportDesc.store(buffer);
  }
}

export class ExportDescNode {
  tag: number;
  index: number;

  constructor(buffer: Buffer) {
    this.tag = buffer.readByte();
    this.index = buffer.readU32();
  }

  store(buffer: Buffer) {
    buffer.writeByte(this.tag);
    buffer.writeU32(this.index);
  }
}

export class LocalsNode {
  num: number;
  valType: ValType;

  constructor(buffer: Buffer) {
    this.num = buffer.readU32();
    this.valType = buffer.readByte() as ValType;
  }

  store(buffer: Buffer) {
    buffer.writeU32(this.num);
    buffer.writeByte(this.valType);
  }
}

type InstrNode =
  | BlockInstrNode
  | LoopInstrNode
  | CallInstrNode
  | BrIfInstrNode
  | BrIfInstrNode
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
  endOp!: typeof OPCODE.END | typeof OPCODE.ELSE;

  constructor(buffer: Buffer) {
    while (true) {
      const opcode = buffer.readByte() as OPCODE;
      if (opcode === OPCODE.END || opcode === OPCODE.ELSE) {
        this.endOp = opcode;
        break;
      }
      this.instrs.push(createInstrNode(opcode, buffer));
      if (buffer.eof) break;
    }
  }

  store(buffer: Buffer) {
    for (const instr of this.instrs) {
      instr.store(buffer);
    }
    buffer.writeByte(this.endOp);
  }
}

const createInstrNode = (opcode: OPCODE, buffer: Buffer) => {
  switch (opcode) {
    case OPCODE.BLOCK:
      return new BlockInstrNode(buffer);
    case OPCODE.LOOP:
      return new LoopInstrNode(buffer);
    case OPCODE.BR:
      return new BrInstrNode(buffer);
    case OPCODE.BR_IF:
      return new BrIfInstrNode(buffer);
    case OPCODE.BLOCK:
      return new BlockInstrNode(buffer);
    case OPCODE.IF:
      return new IfInstrNode(buffer);
    case OPCODE.CALL:
      return new CallInstrNode(buffer);
    case OPCODE.I32_CONST:
      return new I32ConstInstrNode(buffer);
    case OPCODE.LOCAL_GET:
      return new LocalGetInstrNode(buffer);
    case OPCODE.LOCAL_SET:
      return new LocalSetInstrNode(buffer);
    case OPCODE.I32_ADD:
      return new I32AddInstrNode();
    case OPCODE.I32_EQZ:
      return new I32EqzInstrNode();
    case OPCODE.I32_LT_S:
      return new I32LtSInstrNode();
    case OPCODE.I32_GE_S:
      return new I32GeSInstrNode();
    case OPCODE.I32_REM_S:
      return new I32RemSInstrNode();
    default:
      throw new Error(`invalid opcode: 0x${opcode.toString(16)}`);
  }
};

export class BlockInstrNode {
  blockType: BlockType;
  instrs: ExprNode;

  constructor(buffer: Buffer) {
    this.blockType = buffer.readByte();
    this.instrs = new ExprNode(buffer);
  }

  store(buffer: Buffer) {
    buffer.writeByte(OPCODE.BLOCK);
    buffer.writeByte(this.blockType);
    this.instrs.store(buffer);
  }
}

export class LoopInstrNode {
  blockType: BlockType;
  instrs: ExprNode;

  constructor(buffer: Buffer) {
    this.blockType = buffer.readByte();
    this.instrs = new ExprNode(buffer);
  }

  store(buffer: Buffer) {
    buffer.writeByte(OPCODE.LOOP);
    buffer.writeByte(this.blockType);
    this.instrs.store(buffer);
  }
}

export class BrInstrNode {
  labelIdx: LabelIdx;

  constructor(buffer: Buffer) {
    this.labelIdx = buffer.readU32();
  }

  store(buffer: Buffer) {
    buffer.writeByte(OPCODE.BR);
    buffer.writeU32(this.labelIdx);
  }
}

export class BrIfInstrNode {
  labelIdx: LabelIdx;

  constructor(buffer: Buffer) {
    this.labelIdx = buffer.readU32();
  }

  store(buffer: Buffer) {
    buffer.writeByte(OPCODE.BR_IF);
    buffer.writeU32(this.labelIdx);
  }
}
type LabelIdx = number;

export class IfInstrNode {
  blockType: BlockType;
  thenInstrs: ExprNode;
  elseInstrs?: ExprNode;

  constructor(buffer: Buffer) {
    this.blockType = buffer.readByte();
    this.thenInstrs = new ExprNode(buffer);
    if (this.thenInstrs.endOp === OPCODE.ELSE) {
      this.elseInstrs = new ExprNode(buffer);
    }
  }

  store(buffer: Buffer) {
    buffer.writeByte(OPCODE.IF);
    buffer.writeByte(this.blockType);
    this.thenInstrs.endOp = this.elseInstrs ? OPCODE.ELSE : OPCODE.END;
    this.thenInstrs.store(buffer);
    this.elseInstrs?.store(buffer);
  }
}
type S33 = number;
type BlockType = typeof OPCODE.IF | ValType | S33;

export class CallInstrNode {
  funcIdx: FuncIdx;

  constructor(buffer: Buffer) {
    this.funcIdx = buffer.readU32();
  }

  store(buffer: Buffer) {
    buffer.writeByte(OPCODE.CALL);
    buffer.writeU32(this.funcIdx);
  }
}
type FuncIdx = number;

export class I32ConstInstrNode {
  op = OPCODE.I32_CONST;
  num: number;

  constructor(buffer: Buffer) {
    this.num = buffer.readI32();
  }

  store(buffer: Buffer) {
    buffer.writeByte(OPCODE.I32_CONST);
    buffer.writeI32(this.num);
  }
}

export class LocalGetInstrNode {
  op = OPCODE.LOCAL_GET;
  localIdx: number;

  constructor(buffer: Buffer) {
    this.localIdx = buffer.readU32();
  }

  store(buffer: Buffer) {
    buffer.writeByte(OPCODE.LOCAL_GET);
    buffer.writeU32(this.localIdx);
  }
}

export class LocalSetInstrNode {
  op = OPCODE.LOCAL_SET;
  localIdx: number;

  constructor(buffer: Buffer) {
    this.localIdx = buffer.readU32();
  }

  store(buffer: Buffer) {
    buffer.writeByte(OPCODE.LOCAL_SET);
    buffer.writeU32(this.localIdx);
  }
}

export class I32AddInstrNode {
  op = OPCODE.I32_ADD;

  store(buffer: Buffer) {
    buffer.writeByte(OPCODE.I32_ADD);
  }
}
export class I32EqzInstrNode {
  op = OPCODE.I32_EQZ;

  store(buffer: Buffer) {
    buffer.writeByte(OPCODE.I32_EQZ);
  }
}
export class I32LtSInstrNode {
  op = OPCODE.I32_LT_S;

  store(buffer: Buffer) {
    buffer.writeByte(OPCODE.I32_LT_S);
  }
}
export class I32GeSInstrNode {
  op = OPCODE.I32_GE_S;

  store(buffer: Buffer) {
    buffer.writeByte(OPCODE.I32_GE_S);
  }
}
export class I32RemSInstrNode {
  op = OPCODE.I32_REM_S;

  store(buffer: Buffer) {
    buffer.writeByte(OPCODE.I32_REM_S);
  }
}
